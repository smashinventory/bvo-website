'use strict';

/**
 * Canonical vanity width buckets — shared source of truth (Rule 10).
 *
 * Used by:
 *   - src/controllers/collectionsController.js  (sidebar chip filter + getAvailableWidths +
 *                                                model-group display_mode handler)
 *   - src/middleware/megaMenuData.js            (dynamic mega menu size chips)
 *   - src/models/Product.js findByCategory()   (size_in WHERE clause mirrors these ranges)
 *
 * To add, remove, or adjust a bucket — change it HERE ONLY.
 * Product.js findByCategory() size_in handler must stay in sync with boundary logic:
 *   '20-' → width_in <= 22
 *   '84+' → width_in >= 82
 *   others → width_in BETWEEN (label - 2) AND (label + 2)
 */
const SIZE_BUCKETS = [
  { label: '20-', min: 0,   max: 22        }, // catches 16, 18, 20
  { label: '25',  min: 23,  max: 27        },
  { label: '30',  min: 28,  max: 32        },
  { label: '36',  min: 34,  max: 38        },
  { label: '42',  min: 40,  max: 44        },
  { label: '48',  min: 46,  max: 50        },
  { label: '54',  min: 52,  max: 56        },
  { label: '60',  min: 58,  max: 62        },
  { label: '66',  min: 64,  max: 68        },
  { label: '72',  min: 70,  max: 74        },
  { label: '84+', min: 82,  max: Infinity  }, // catches 84, 96, 120+
];

module.exports = { SIZE_BUCKETS };
