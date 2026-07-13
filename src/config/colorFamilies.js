'use strict';

/**
 * Canonical color families for BVO cabinet finish normalization.
 *
 * Each family has:
 *   key     — stored in product_attribute_values.color_family
 *   label   — shown in filter sidebar
 *   hex     — swatch circle fill color
 *   border  — swatch circle border color
 *   members — manufacturer color strings that belong to this family
 *             (matched case-insensitively; partial-match fallback)
 *
 * Used at:
 *   1. Import time  — importJamesMartinFeed.js calls normalize() to populate color_family
 *   2. Query time   — collectionsController passes FAMILIES to the view for swatch rendering
 *   3. Filter time  — Product.findByCategory uses color_family column for family-level queries
 */

const FAMILIES = [
  {
    key: 'white',
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
    label: 'Cream',
    hex: '#e8d9b8',
    border: '#c8b890',
    members: [
      'Cream', 'Ivory', 'Off-White', 'Champagne', 'Wheat', 'Tan', 'Linen',
      'Sand', 'Almond', 'Antique White', 'Biscuit', 'Cotton', 'Parchment',
      'Vanilla', 'Bisque',
    ],
  },
  {
    key: 'gray',
    label: 'Gray',
    hex: '#8a8f96',
    border: '#6e7480',
    members: [
      'Gray', 'Grey', 'Dove Gray', 'Silver', 'Storm Gray', 'Fog', 'Pewter',
      'Slate', 'Ash', 'Light Gray', 'Dark Gray', 'Charcoal Gray', 'Cement',
      'Smoke', 'Steel Gray', 'Moon Gray', 'Mineral Gray', 'Stonehenge Gray',
      'Graphite Gray',
    ],
  },
  {
    key: 'black',
    label: 'Black',
    hex: '#2a2a2a',
    border: '#111111',
    members: [
      'Matte Black', 'Black', 'Peppercorn', 'Dark Charcoal', 'Ebony', 'Onyx',
      'Jet Black', 'Charcoal Black', 'Matte Charcoal', 'Rich Black',
      'Carbon Black', 'Graphite Black',
    ],
  },
  {
    key: 'blue',
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
    label: 'Green',
    hex: '#4a7c59',
    border: '#3a6249',
    members: [
      'Green', 'Forest Green', 'Sage', 'Sage Green', 'Hunter Green', 'Olive',
      'Moss', 'Emerald', 'Eucalyptus', 'Herb', 'Fern', 'Succulent',
    ],
  },
  {
    key: 'wood_l',
    label: 'Light Wood',
    hex: '#c9b89a',
    border: '#a89070',
    members: [
      'Gray Oak', 'Natural Oak', 'Oak', 'Blonde', 'Maple', 'Birch',
      'Light Wood', 'Honey Oak', 'Whitewashed Oak', 'Weathered Oak',
      'Cerused Oak', 'Driftwood', 'Pale Oak', 'White Oak', 'Ash Wood',
    ],
  },
  {
    key: 'wood_m',
    label: 'Med Wood',
    hex: '#8b6840',
    border: '#6b4820',
    members: [
      'Walnut', 'Chestnut', 'Warm Brown', 'Teak', 'Medium Wood', 'Caramel',
      'Hazelnut', 'Auburn', 'Tobacco', 'Cognac', 'Cinnamon', 'Terracotta',
    ],
  },
  {
    key: 'wood_d',
    label: 'Dark Wood',
    hex: '#3e2a14',
    border: '#2a1a08',
    members: [
      'Espresso', 'Dark Walnut', 'Dark Mahogany', 'Black Forest', 'Dark Wood',
      'Ebony Wood', 'Antique Mahogany', 'Java', 'Umber', 'Dark Pecan',
      'Burnished Mahogany',
    ],
  },
];

// ── Fast lookup map: lowercase member string → family key ──────────────
// Built once at module load.
const _lookup = new Map();
FAMILIES.forEach(fam => {
  fam.members.forEach(m => _lookup.set(m.toLowerCase(), fam.key));
});

/**
 * Normalize a raw manufacturer color/finish string to a family key.
 *
 * Strategy:
 *   1. Exact case-insensitive match against member list
 *   2. Substring scan — e.g. "Peppercorn Black" contains "peppercorn" → 'black'
 *   3. Returns null if no family matched (use 'other' bucket in UI)
 *
 * @param  {string} rawValue  e.g. "Peppercorn Black", "Gray Oak", "Matte Black"
 * @returns {string|null}      family key or null
 */
function normalize(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const lower = rawValue.trim().toLowerCase();

  // 1 — exact match
  if (_lookup.has(lower)) return _lookup.get(lower);

  // 2 — partial match (longer member strings first to prefer specificity)
  const keys = [..._lookup.keys()].sort((a, b) => b.length - a.length);
  for (const memberLower of keys) {
    if (lower.includes(memberLower)) return _lookup.get(memberLower);
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

module.exports = { FAMILIES, normalize, getFamily };
