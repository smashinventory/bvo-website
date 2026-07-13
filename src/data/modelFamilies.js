'use strict';

/**
 * MODEL_FAMILIES — one entry per James Martin vanity collection line.
 *
 * Each family aggregates all finish/size variants that exist across the
 * product catalogue (PLACEHOLDER or DB).  The homepage "All Models"
 * section reads this file directly; the collection filter uses the `slug`
 * field to match product names.
 *
 * To add a new model when more products are imported:
 *   1. Add an entry here with its finishes and sizes.
 *   2. The collection controller already reads ?model= and filters by name.
 */
const MODEL_FAMILIES = [
  {
    name:  'Brookfield',
    brand: 'James Martin',
    slug:  'brookfield',          // matched case-insensitively against product names
    finishes: [
      { name: 'Antique Black',      hex: '#2C2C2C', image: 'http://images.salsify.com/image/upload/s--CRxRsrJ4--/jimtf8tnbdtwyi1udvnk.jpg',                    productSlug: '147-114-5236-3af' },
      { name: 'Country Oak',        hex: '#C9A96E', image: 'http://images.salsify.com/image/upload/s--E2xTLxOz--/nbdxnpigyj3abpodmpdl.jpg',                    productSlug: '147-114-5576-3af' },
      { name: 'Burnished Mahogany', hex: '#6B2C1F', image: 'http://images.salsify.com/image/upload/s--9cf2OvwQ--/71dab93d635e9aa689edf9636135f83d87e5f2e6.jpg', productSlug: '147-114-5761-3af' },
      { name: 'Warm Cherry',        hex: '#8B2500', image: 'http://images.salsify.com/image/upload/s--RfQzfMEi--/bd5ab5c58f414c0953747bd12f0f494ca46703a6.jpg', productSlug: '147-114-v26-wch-3af' },
    ],
    sizes:             [24, 36, 48, 72],
    price_from:        1765,   // 24" Warm Cherry
    price_to:          4329,   // 72" Burnished Mahogany
    compare_price_from: 2674,
  },
  {
    name:  'Linear',
    brand: 'James Martin',
    slug:  'linear',
    finishes: [
      { name: 'Glossy White',       hex: '#F0F0EF', image: 'http://images.salsify.com/image/upload/s--FKbk-jC1--/ycfsgpny4z04owppkm6r.jpg',  productSlug: '210-v36-gw-dgg' },
      { name: 'Mid Century Walnut', hex: '#7B4F2E', image: 'http://images.salsify.com/image/upload/s--vH2FBBKS--/xt3apgku4jw53qebhp0u.jpg', productSlug: '210-v59d-wlt-dgg' },
    ],
    sizes:             [36, 60],
    price_from:        2579,   // 36" Glossy White
    price_to:          4480,   // 60" Mid Century Walnut
    compare_price_from: 3908,
  },
  {
    name:  'Chicago',
    brand: 'James Martin',
    slug:  'chicago',
    finishes: [
      { name: 'Whitewashed Walnut', hex: '#C4A882', image: 'http://images.salsify.com/image/upload/s--L2YcrO_3--/a36e5c0d5dde31e83bcdb25e5f9d40d1c49a4f4d.jpg', productSlug: '305-v48-www-3af' },
    ],
    sizes:             [48],
    price_from:        3109,
    price_to:          3109,
    compare_price_from: 4711,
  },
  {
    name:  'Copper Cove Encore',
    brand: 'James Martin',
    slug:  'copper-cove-encore',
    finishes: [
      { name: 'Bright White', hex: '#F5F5F5', image: 'http://images.salsify.com/image/upload/s--C3B7nv8w--/1fe33f53eea37e207c7ba40f4863d4e35f2191de.jpg', productSlug: '301-v48-bw-3af' },
    ],
    sizes:             [48],
    price_from:        3389,
    price_to:          3389,
    compare_price_from: 5135,
  },
  {
    name:  'Bristol',
    brand: 'James Martin',
    slug:  'bristol',
    finishes: [
      { name: 'Saddle Brown', hex: '#8B4513', image: 'http://images.salsify.com/image/upload/s--ibX3d2mV--/k5glycejskohmj9jjmma.jpg', productSlug: '157-v60d-sbr-3af' },
    ],
    sizes:             [60],
    price_from:        4084,
    price_to:          4084,
    compare_price_from: 6188,
  },
  {
    name:  'Addison',
    brand: 'James Martin',
    slug:  'addison',
    finishes: [
      { name: 'Mid Century Acacia', hex: '#B5956A', image: 'http://images.salsify.com/image/upload/s--2gjCwP4a--/rnusb5pvqfnjblunxsde.jpg', productSlug: 'e444-v30-mca-3af' },
    ],
    sizes:             [30],
    price_from:        2229,
    price_to:          2229,
    compare_price_from: 3378,
  },
  {
    name:  'Columbia',
    brand: 'James Martin',
    slug:  'columbia',
    finishes: [
      { name: 'Ash Gray', hex: '#9E9E9E', image: 'http://images.salsify.com/image/upload/s--EGv8J0a4--/rtiad22didae5oapbfmq.jpg', productSlug: '388-v24-agr-bnk' },
    ],
    sizes:             [24],
    price_from:        1368,
    price_to:          1368,
    compare_price_from: 2073,
  },
];

module.exports = MODEL_FAMILIES;
