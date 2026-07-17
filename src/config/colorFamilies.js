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
      'Slate', 'Ash', 'Light Gray', 'Dark Gray', 'Charcoal Gray', 'Cement',
      'Smoke', 'Steel Gray', 'Moon Gray', 'Mineral Gray', 'Stonehenge Gray',
      'Graphite Gray', 'Metal Gray',
      // NOTE: 'Silver' moved to chrome metal family
      // NOTE: 'Pewter' moved to pewter metal family
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
      'Cerused Oak', 'Driftwood', 'Pale Oak', 'White Oak', 'Ash Wood',
      'White Ash', 'Natural White Ash', 'Whitewashed Ash',
      // JM additions — exact matches override partial-match conflicts below
      'Honey Alder', 'Alder',
      'Natural Ash',       // override: "ash" member maps to gray; exact match wins
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
    if (lower.includes(memberLower)) return lookup.get(memberLower);
  }

  return null;
}

/**
 * Returns the family object for a given key, or null.
 * @param {string} key
 * @returns {object|null}
 */
function getFamily(key) {
  return FAMILIES.find(f => f.key === key) || null;
}

module.exports = { FAMILIES, normalize, getFamily, CABINET_KEYS, METAL_KEYS };
