'use strict';

/**
 * Canonical color families for BVO finish normalization.
 *
 * Covers two distinct finish contexts:
 *   type: 'cabinet' — paint/stain finishes for vanity cabinets
 *   type: 'metal'   — metallic/hardware finishes for mirrors, faucets,
 *                     accessories, lighting, storage, and vanity hardware pulls
 *
 * Each family has:
 *   key      — stored in products.color_family
 *   type     — 'cabinet' | 'metal'  (drives context-aware normalization)
 *   label    — shown in filter sidebar
 *   hex      — swatch circle fill color
 *   border   — swatch circle border color
 *   members  — vendor color strings that belong to this family
 *              (matched case-insensitively; partial-match fallback)
 *
 * Used at:
 *   1. Import time  — normalize(vendorColor, context) populates color_family
 *   2. Query time   — collectionsController passes FAMILIES to the view
 *   3. Filter time  — Product.findByCategory uses color_family for family queries
 *   4. Import guard — color_mappings DB table checked as fallback before null
 *
 * Context-aware normalization prevents cross-family collisions, e.g.
 * "Silver Fox" (cabinet gray) vs "Silver" (chrome hardware finish).
 *   normalize('Silver Fox', 'cabinet') → 'gray'
 *   normalize('Silver',     'metal')   → 'chrome'
 */

const FAMILIES = [

  // ── Cabinet finish families ────────────────────────────────────────────

  {
    key: 'white',
    type: 'cabinet',
    label: 'White',
    hex: '#f5f5f3',
    border: '#c8c8c4',
    members: [
      'White', 'Glossy White', 'Soft White', 'Bright White', 'Pearl White',
      'Pure White', 'Matte White', 'Satin White', 'Semi-Gloss White',
    ],
  },
  {
    key: 'cream',
    type: 'cabinet',
    label: 'Cream',
    hex: '#e8d9b8',
    border: '#c8b890',
    members: [
      'Cream', 'Ivory', 'Off-White', 'Champagne', 'Wheat', 'Tan', 'Linen',
      'Sand', 'Almond', 'Antique White', 'Biscuit', 'Cotton', 'Parchment',
      'Vanilla', 'Bisque',
      'Mountain Mist', 'Mist',
      'Vintage Vanilla',
    ],
  },
  {
    key: 'gray',
    type: 'cabinet',
    label: 'Gray',
    hex: '#8a8f96',
    border: '#6e7480',
    members: [
      'Gray', 'Grey', 'Dove Gray', 'Storm Gray', 'Fog',
      'Slate', 'Light Gray', 'Dark Gray', 'Charcoal Gray', 'Cement',
      'Smoke', 'Steel Gray', 'Moon Gray', 'Mineral Gray', 'Stonehenge Gray',
      'Graphite Gray', 'Metal Gray',
      // NOTE: 'Silver' moved to chrome metal family
      // NOTE: 'Pewter' moved to pewter metal family
      // NOTE: 'Ash' moved to wood_l, 2026-09-16 (Sam). Ash is a pale hardwood,
      //   not the grey residue of a fire. It sat here and pulled 44 wood
      //   products into Gray. The five 'Ash' compounds that had been patched
      //   into wood_l one at a time were the symptom — see wood_l members.
      //   'Ash Gray' still resolves to gray: 'Gray' is 4 chars to 'Ash's 3 and
      //   the longest member wins.
    ],
  },
  {
    key: 'black',
    type: 'cabinet',
    label: 'Black',
    hex: '#2a2a2a',
    border: '#111111',
    members: [
      'Matte Black', 'Black', 'Peppercorn', 'Dark Charcoal', 'Ebony', 'Onyx',
      'Jet Black', 'Charcoal Black', 'Matte Charcoal', 'Rich Black',
      'Carbon Black', 'Graphite Black',
      // NOTE: 'Matte Black' is intentionally shared with the matte_black metal family.
      // Context-aware normalize() resolves the correct family:
      //   context='cabinet' → 'black'   (painted cabinet)
      //   context='metal'   → 'matte_black'  (hardware finish)
      //   context='all'     → 'matte_black'  (metal entry written last, wins)
    ],
  },
  {
    key: 'blue',
    type: 'cabinet',
    label: 'Blue',
    hex: '#182840',
    border: '#0d1f35',
    members: [
      'Navy Blue', 'Navy', 'Blue', 'Cobalt Blue', 'Steel Blue', 'Ocean Blue',
      'Midnight', 'Midnight Blue', 'Dark Blue', 'Light Blue', 'Sky Blue',
      'Denim', 'Admiral Blue', 'Prussian Blue', 'Slate Blue',
    ],
  },
  {
    key: 'green',
    type: 'cabinet',
    label: 'Green',
    hex: '#4a7c59',
    border: '#3a6249',
    members: [
      'Green', 'Forest Green', 'Sage', 'Sage Green', 'Hunter Green', 'Olive',
      'Moss', 'Emerald', 'Eucalyptus', 'Herb', 'Fern', 'Succulent',
      // JM additions
      'Pistachio',      // James Martin — muted green cabinet finish
      'Smokey Celadon', // James Martin — blue-green, user confirmed green (not gray)
    ],
  },
  {
    key: 'wood_l',
    type: 'cabinet',
    label: 'Light Wood',
    hex: '#c9b89a',
    border: '#a89070',
    woodGrain: true,
    members: [
      'Gray Oak', 'Natural Oak', 'Oak', 'Blonde', 'Maple', 'Birch',
      'Light Wood', 'Honey Oak', 'Whitewashed Oak', 'Weathered Oak',
      'Cerused Oak', 'Driftwood', 'Pale Oak', 'White Oak',
      /* 'Ash' is the family member that matters — a pale hardwood. Moved here
         from gray on 2026-09-16. The compounds below it were each added
         separately to work around its absence; they are kept because an exact
         match is cheaper than a scan, but none of them is load-bearing now. */
      'Ash', 'Ash Wood', 'White Ash', 'Natural White Ash', 'Whitewashed Ash',
      'Natural Ash', 'Rustic Ash', 'Platinum Ash',
      // JM additions — exact matches override partial-match conflicts below
      'Honey Alder', 'Alder',
      'Silver Apricot',    // override: "silver" member maps to chrome; exact match wins
      'Champagne Tiger',   // override: "champagne" member maps to cream; exact match wins
    ],
  },
  {
    key: 'wood_m',
    type: 'cabinet',
    label: 'Med Wood',
    hex: '#8b6840',
    border: '#6b4820',
    woodGrain: true,
    members: [
      'Walnut', 'Chestnut', 'Warm Brown', 'Teak', 'Medium Wood', 'Caramel',
      'Hazelnut', 'Auburn', 'Tobacco', 'Cognac', 'Cinnamon', 'Terracotta',
      'Desert Oak',
      // JM additions
      'Acacia', 'Mid Century Acacia',
      'Saddle Brown', 'Saddle',
      'Natural Apple Wood', 'Natural Applewood', 'Apple Wood', 'Applewood',
      'Zebrano', 'Natural Zebrano Wood', 'Zebrawood',
      'Pecan', // James Martin — medium warm brown wood finish
    ],
  },
  {
    key: 'wood_d',
    type: 'cabinet',
    label: 'Dark Wood',
    hex: '#3e2a14',
    border: '#2a1a08',
    woodGrain: true,
    members: [
      'Espresso', 'Dark Walnut', 'Dark Mahogany', 'Black Forest', 'Dark Wood',
      'Ebony Wood', 'Antique Mahogany', 'Java', 'Umber', 'Dark Pecan',
      'Burnished Mahogany',
      // JM additions
      'Dark Amber', 'Amber Wood',
      'Burl', 'English Burl', 'Twilight Burl',
      'Olive Ash Eclipse',  // override: "olive" member maps to green; exact match wins
      'Sable',              // James Martin — very dark brown cabinet finish
    ],
  },
  {
    key: 'cherry',
    type: 'cabinet',
    label: 'Cherry',
    hex: '#8B3A2A',
    border: '#6a2a1a',
    members: [
      'Warm Cherry', 'Cherry', 'Deep Cherry', 'Cherry Glaze', 'Warm Red',
    ],
  },
  {
    key: 'rose',
    type: 'cabinet',
    label: 'Rose',
    hex: '#C4848A',
    border: '#A06068',
    members: [
      'Rose', 'Dusty Rose', 'Blush', 'Mauve', 'Rose Pink', 'Soft Rose',
      'Blush Pink', 'Antique Rose', 'Muted Rose',
    ],
  },

  // ── Metallic / hardware finish families ───────────────────────────────
  // Used for: mirrors, faucets, accessories, lighting, storage (primary color)
  //           vanity hardware_finish (secondary color layer)

  {
    key: 'chrome',
    type: 'metal',
    label: 'Chrome',
    hex: '#C0C0C0',
    border: '#A0A0A0',
    members: [
      'Chrome', 'Polished Chrome', 'Brushed Chrome',
      'Stainless Steel', 'Polished Stainless', 'Stainless',
      'Silver',
    ],
  },
  {
    key: 'nickel',
    type: 'metal',
    label: 'Brushed Nickel',
    hex: '#8C8680',
    border: '#6C6660',
    members: [
      'Brushed Nickel', 'Satin Nickel', 'Polished Nickel',
      'Antique Nickel', 'Spot-Resist Nickel', 'Nickel',
    ],
  },
  {
    key: 'pewter',
    type: 'metal',
    label: 'Pewter',
    hex: '#8E9297',
    border: '#6E7380',
    members: [
      'Pewter', 'Polished Pewter', 'Brushed Pewter',
      'Antique Pewter', 'Hammered Pewter',
    ],
  },
  {
    key: 'bronze',
    type: 'metal',
    label: 'Bronze',
    hex: '#4A3728',
    border: '#3A2718',
    members: [
      'Oil-Rubbed Bronze', 'Venetian Bronze', 'Mediterranean Bronze',
      'Rubbed Bronze', 'Antique Bronze', 'Tumbled Bronze', 'Bronze',
    ],
  },
  {
    key: 'copper',
    type: 'metal',
    label: 'Copper',
    hex: '#B87333',
    border: '#8B5A1A',
    members: [
      'Copper', 'Polished Copper', 'Brushed Copper',
      'Hammered Copper', 'Antique Copper', 'Oil-Rubbed Copper',
    ],
  },
  {
    key: 'gold',
    type: 'metal',
    label: 'Gold / Brass',
    hex: '#B5924C',
    border: '#8B6A2C',
    members: [
      'Polished Gold', 'Brushed Gold', 'Polished Brass', 'Brushed Brass',
      'Antique Brass', 'Satin Brass', 'Champagne Bronze', 'Champagne Gold',
      'Gold', 'Brass',
      'Radiant Gold', // James Martin — brushed gold metallic cabinet finish (primary color, not HW)
    ],
  },
  {
    key: 'matte_black',
    type: 'metal',
    label: 'Matte Black',
    hex: '#1C1C1C',
    border: '#111111',
    members: [
      'Matte Black', 'Flat Black', 'Gunmetal Black', 'Gunmetal',
    ],
  },
];

// ── Exported key sets ──────────────────────────────────────────────────
const CABINET_KEYS = FAMILIES.filter(f => f.type === 'cabinet').map(f => f.key);
const METAL_KEYS   = FAMILIES.filter(f => f.type === 'metal').map(f => f.key);

// ── Context-aware lookup maps (built once at module load) ──────────────
// In the 'all' map, metal families are written after cabinet families,
// so shared entries (e.g. 'Matte Black') resolve to the metal family.
function _buildLookup(families) {
  const map = new Map();
  families.forEach(fam => {
    fam.members.forEach(m => map.set(m.toLowerCase(), fam.key));
  });
  return map;
}

const _lookupAll     = _buildLookup(FAMILIES);
const _lookupCabinet = _buildLookup(FAMILIES.filter(f => f.type === 'cabinet'));
const _lookupMetal   = _buildLookup(FAMILIES.filter(f => f.type === 'metal'));

/**
 * Normalize a raw vendor color/finish string to a BVO family key.
 *
 * @param  {string} rawValue   e.g. "Polished Pewter", "Gray Oak", "Matte Black"
 * @param  {string} [context]  'cabinet' | 'metal' | 'all'  (default: 'all')
 * @returns {string|null}       family key, or null if no match found.
 *                              null → caller should check color_mappings DB
 *                              table before treating as unmapped.
 *
 * Strategy:
 *   1. Exact case-insensitive match against the context-filtered member list
 *   2. Substring scan — longer member strings checked first for specificity
 *   3. Returns null (triggers import guard prompt / admin report flag)
 *
 * Examples:
 *   normalize('Silver Fox',  'cabinet') → 'gray'       (contains 'ash'? no; 'gray'? no;
 *                                                        'silver'? no — 'silver' not in cabinet
 *                                                        lookup → null → import guard)
 *   normalize('Silver',      'metal')   → 'chrome'
 *   normalize('Matte Black', 'cabinet') → 'black'
 *   normalize('Matte Black', 'metal')   → 'matte_black'
 *   normalize('Matte Black', 'all')     → 'matte_black'  (metal wins)
 */
function normalize(rawValue, context = 'all') {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const lower = rawValue.trim().toLowerCase();

  const lookup = context === 'cabinet' ? _lookupCabinet
               : context === 'metal'   ? _lookupMetal
               : _lookupAll;

  // 1 — exact match
  if (lookup.has(lower)) return lookup.get(lower);

  // 2 — partial match (longer member strings first for specificity)
  const keys = [...lookup.keys()].sort((a, b) => b.length - a.length);
  for (const memberLower of keys) {
    if (_containsWord(lower, memberLower)) return lookup.get(memberLower);
  }

  return null;
}

/**
 * Does `needle` appear in `haystack` as a whole word (or whole phrase)?
 *
 * WHY THIS IS NOT String.includes()
 *
 * It was, until 2026-09-16, and a plain substring test matches inside words:
 *
 *   'Sunwashed Oak'        contains 'ash'   -> Sunw(ash)ed   -> gray
 *   'Oyster Shagreen'      contains 'green' -> Sha(green)    -> green
 *
 * 57 wood products were filed under Gray and Green by those two matches. The
 * bug is not that 'ash' or 'green' are wrong members — both are legitimate —
 * it is that a colour name is a sequence of words and a match that starts
 * mid-word is not a match at all.
 *
 * This is the third appearance of the same mistake on this project: a LIKE
 * '%LED%' that counted 'contro(lled)' and 'insta(lled)' as lighted mirrors,
 * and a brand comparison that matched on a fragment. Any new membership or
 * keyword test should assume word boundaries unless there is a stated reason
 * not to.
 *
 * A boundary is the start of the string, the end of it, or any character that
 * is not a letter or digit. Hyphens and slashes therefore count as boundaries,
 * which is intended: 'off-white' must still match the member 'white', and
 * 'Black Onyx / Antique Black' must still match 'black'.
 *
 * Scans every occurrence, not just the first — 'ashen ash' must still match.
 *
 * @param  {string} haystack  already lower-cased
 * @param  {string} needle    already lower-cased
 * @returns {boolean}
 */
function _containsWord(haystack, needle) {
  if (!needle) return false;
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) return false;
    const before = i === 0 ? '' : haystack[i - 1];
    const after  = haystack[i + needle.length] || '';
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    from = i + 1;                      // overlapping occurrences still checked
  }
}

/**
 * Returns the family object for a given key, or null.
 * @param {string} key
 * @returns {object|null}
 */
function getFamily(key) {
  return FAMILIES.find(f => f.key === key) || null;
}

/* ═══════════════════════════════════════════════════════════════════════
   DUAL BUCKETS — colours that belong in more than one filter swatch
   ═══════════════════════════════════════════════════════════════════════

   Approved by Sam, 2026-09-16:

     "a person looking for cream may be presented with a few brass options
      and like one. I just want a decent balance of options that are very
      close to what the shopper wants."

   So a product may surface under more than one colour swatch. Two kinds of
   colour qualify:

     two-tone     the NAME carries two colours — 'Matte White with Gold'
     ambiguous    one colour that shoppers reasonably look for in two places
                  — 'Champagne Brass' is brass, but reads cream to some

   WHY THIS LIST IS EXPLICIT AND NOT A RULE

   The obvious rule — "when normalize('cabinet') and normalize('metal')
   disagree, use both" — was written, measured, and rejected. It gets
   'Silver Oak' wrong: the contexts disagree (wood_l vs chrome) but it is a
   wood and chrome would put a wood-framed mirror in the Chrome swatch. No
   automatic rule can know that. Nine strings is a short enough list to state
   outright, and a wrong entry here is visible rather than inferred.

   Catalogue-wide this touches 65 products of 4,972. Vanities are untouched
   except for Matte Black and the Celeste run, so the two-layer cabinet /
   hardware system on vanities is unaffected.

   ADDING TO THIS LIST

   Key on the vendor colour string, lower-cased. `primary` drives the card
   swatch and products.color_family — one value, always. `alt` is every
   ADDITIONAL swatch the product should surface under; [] means "no bleed,
   deliberately", which is not the same as being absent from this list.

   A colour that arrives ambiguous and is NOT here gets one bucket and shows
   up in the admin Color Family Report for a decision. That is the intended
   path: new colours do not quietly bleed somewhere nobody chose.        */
const DUAL_BUCKET = new Map([
  // vendor colour (lower-case)                          primary   also shows in
  ['matte black',                                       { primary: 'black',  alt: ['matte_black'] }],
  ['sunwashed oak with embossed shagreen drawer fronts',{ primary: 'wood_l', alt: ['cream'] }],
  ['polished white and light mappa burl',               { primary: 'white',  alt: ['wood_d'] }],
  ['champagne brass',                                   { primary: 'gold',   alt: ['cream'] }],
  ['silver gray',                                       { primary: 'gray',   alt: ['chrome'] }],
  ['matte white with gold',                             { primary: 'white',  alt: ['gold'] }],
  ['silver with delft blue',                            { primary: 'blue',   alt: ['chrome'] }],
  ['oyster shagreen',                                   { primary: 'cream',  alt: ['wood_l'] }],
  /* Silver Oak is a wood. The contexts disagree (wood_l vs chrome) and the
     disagreement is meaningless — listed here with an empty alt so that a
     future reader sees it was considered and declined, rather than missed. */
  ['silver oak',                                        { primary: 'wood_l', alt: [] }],
]);

/**
 * The one place that turns a vendor colour string into filter buckets.
 *
 * Importers call THIS, not normalize() directly, so that the dual-bucket
 * decision cannot be implemented differently by two callers (Rule 8).
 *
 * Resolution order, highest priority first:
 *
 *   1. adminMappings   — the color_mappings table, set through the admin
 *                        Color Family Report. An explicit human decision
 *                        outranks everything. Returns no alt: if a mapped
 *                        colour should also bleed, add it to DUAL_BUCKET.
 *   2. DUAL_BUCKET     — the curated list above.
 *   3. normalize()     — context first, then 'all'.
 *
 * @param  {string} rawValue        vendor colour string from the feed
 * @param  {string} [context]       'cabinet' | 'metal' | 'all'
 * @param  {Map}    [adminMappings] lower-cased vendor_color -> family_key
 * @returns {{primary: string|null, alt: string[]}}
 *          primary === null means the colour maps to nothing and the product
 *          appears under NO swatch. That is intended behaviour, confirmed by
 *          Sam on 2026-09-15: "If they do not, then they will not appear in
 *          any bucket. I am fine with that."
 */
function resolveBuckets(rawValue, context = 'all', adminMappings = null) {
  if (!rawValue || typeof rawValue !== 'string') return { primary: null, alt: [] };
  const lower = rawValue.trim().toLowerCase();

  if (adminMappings && adminMappings.has(lower)) {
    return { primary: adminMappings.get(lower), alt: [] };
  }

  const dual = DUAL_BUCKET.get(lower);
  if (dual) return { primary: dual.primary, alt: [...dual.alt] };

  const primary = normalize(rawValue, context) || normalize(rawValue, 'all');
  return { primary: primary || null, alt: [] };
}

module.exports = {
  FAMILIES, normalize, getFamily, CABINET_KEYS, METAL_KEYS,
  DUAL_BUCKET, resolveBuckets,
};
