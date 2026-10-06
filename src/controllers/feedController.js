'use strict';
/* ──────────────────────────────────────────────────────────────────────────
   feedController.js — the Google Merchant Center product feed.

   GET /feeds/google-shopping.xml

   WHY A ROUTE AND NOT A FILE
   An hbuilds deploy rebuilds public_html. A feed written there would vanish
   on the next push and Google would start fetching a 404 — which is exactly
   how public_html/JM_Feed was lost on 2026-09-30. A route is generated from
   the database on demand and cannot be wiped by a deploy.

   WHY THE ITEM BUILDER IS EXPORTED
   buildItems() is exported so gate_gmc_feed.js tests THE REAL DECISION rather
   than a reimplementation of it. A gate that re-derives the rules it is
   checking only proves the gate agrees with itself.

   WHAT THIS DELIBERATELY DOES NOT READ
   products.google_product_category. All 5,035 populated values are invalid —
   not wrong choices, strings that do not exist in Google's taxonomy. See
   utils/googleProductCategory.js for the evidence. The category is derived.
   ────────────────────────────────────────────────────────────────────────── */

const gpc = require('../utils/googleProductCategory');

/* The pool is required LAZILY, inside the request path, not at module load.
   config/database refuses to load without DB_PASS — correct for the app,
   fatal for a gate, which has no credentials and does not need any because
   it drives buildItems() with a stub pool. Requiring it at the top made the
   gate unrunnable, which would have meant testing a reimplementation of
   these rules instead of the rules themselves. Node caches the module, so
   this costs one map lookup per request. */
function defaultPool() {
  return require('../config/database').bvoPool;
}

/* Role A — the site's canonical name, from the one source. Was a literal
   here, which made this the 18th copy and the highest-reach one: it is the
   `link:` on every product Google Merchant Center receives. Same value, so
   the emitted feed is byte-identical. See utils/siteUrl.js. */
const CANON = require('../utils/siteUrl').base();

/* Google fetches once a day. Rendering 6,000 items on every hit would let a
   crawler or a curious visitor turn one URL into a sustained table scan. */
const CACHE_TTL_MS = 60 * 60 * 1000;
let _cache = { xml: null, builtAt: 0, stats: null };

/* ═══ helpers ═══════════════════════════════════════════════════════════ */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  /* Control characters are invalid in XML 1.0 at any escaping level — a
     single stray 0x1A inside a vendor description makes the WHOLE feed
     unparseable, and Google reports it as a fetch failure rather than as a
     bad item, so it is near-impossible to trace back to one product. */
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const txt = (v) => (v == null ? '' : String(v).trim());

/** Strip HTML and collapse whitespace — vendor descriptions arrive as markup. */
function plain(s) {
  return txt(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise a UPC into a GTIN Google will accept, or null.
 *
 * Measured on the 2026-09-30 dump: 5,959 of 6,059 active products carry a
 * 12-digit UPC and EVERY ONE passes the GS1 check digit. Seven do not:
 *   - six are 11 digits, and all six are valid once a leading zero is
 *     restored, which is a spreadsheet stripping it, not bad data. Padded.
 *   - one holds the literal text "Stone Sample - Grey Expo Quart" in the upc
 *     column. Rejected, and it falls back to mpn.
 *
 * Without this, those seven ship malformed identifiers. Google does not
 * ignore a bad gtin — it disapproves the item.
 */
function toGtin(raw) {
  let s = txt(raw).replace(/[\s-]/g, '');
  if (!/^\d+$/.test(s)) return null;
  if (s.length === 11) s = '0' + s;          // restore the stripped zero
  if (![8, 12, 13, 14].includes(s.length)) return null;
  const d = [...s].map(Number);
  const check = d[d.length - 1];
  const body = d.slice(0, -1).reverse();
  const sum = body.reduce((t, n, i) => t + n * (i % 2 === 0 ? 3 : 1), 0);
  return ((10 - (sum % 10)) % 10 === check) ? s : null;
}

/* ═══ the item builder ══════════════════════════════════════════════════ */

/**
 * Build the feed items from the live database.
 * @returns {{items: Array, skipped: Object, scanned: number}}
 *
 * `skipped` is a reason→count map. It is surfaced in an XML comment at the
 * top of the feed and asserted by the gate, so a rule that silently starts
 * dropping half the catalogue is visible rather than inferred from Google's
 * item count three days later.
 */
async function buildItems(pool) {
  pool = pool || defaultPool();
  const [rows] = await pool.query(`
    SELECT p.id, p.sku, p.slug, p.name, p.brand, p.upc, p.mpn,
           p.price, p.compare_price, p.short_desc, p.long_desc,
           p.product_type, p.color, p.material, p.pattern,
           p.weight_lbs, p.total_ship_weight_lbs, p.vendor_group_id,
           p.excluded_destinations, p.google_condition, p.shipping_label,
           p.custom_label_0, p.custom_label_1, p.custom_label_2,
           p.custom_label_3, p.custom_label_4,
           COALESCE(i.qty_on_hand, 0)     AS qty_on_hand,
           COALESCE(i.allow_backorder, 0) AS allow_backorder
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.is_active = 1
     ORDER BY p.id
  `);

  const [imgRows] = await pool.query(`
    SELECT product_id, url, is_primary
      FROM product_images
     ORDER BY product_id, is_primary DESC, sort_order, id
  `);
  const imagesBy = new Map();
  for (const r of imgRows) {
    const u = txt(r.url);
    /* https only. Google refuses http image_link outright, and a product
       whose image it cannot fetch is disapproved rather than shown without
       a picture. */
    if (!u.startsWith('https://')) continue;
    if (!imagesBy.has(r.product_id)) imagesBy.set(r.product_id, []);
    imagesBy.get(r.product_id).push(u);
  }

  const items = [];
  const skipped = Object.create(null);
  const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };

  for (const r of rows) {
    const type = txt(r.product_type);

    /* Excluded on purpose, by product_type. Counted separately from
       "unmapped" so the gate can tell a decision from an oversight. */
    if (gpc.isExcluded(type)) { skip('product_type excluded by policy'); continue; }
    if (!type) { skip('no product_type'); continue; }

    const category = gpc.categoryFor(type);
    if (!category) { skip(`product_type not mapped: ${type}`); continue; }

    /* Per-SKU kill switch. `excluded_destinations` already existed on the
       table and was unused on every row, so it is the lever rather than a
       new column. The value "all" removes the item from the feed outright;
       anything else is passed through to Google as a per-destination
       exclusion (e.g. "Shopping_ads" keeps free listings but blocks spend). */
    const excl = txt(r.excluded_destinations);
    if (excl.toLowerCase() === 'all') { skip('excluded_destinations = all'); continue; }

    const slug = txt(r.slug);
    if (!slug) { skip('no slug'); continue; }

    const sku = txt(r.sku);
    if (!sku) { skip('no sku'); continue; }

    const price = Number(r.price);
    if (!Number.isFinite(price) || price <= 0) { skip('price missing or <= 0'); continue; }

    const imgs = imagesBy.get(r.id) || [];
    if (!imgs.length) { skip('no https image'); continue; }

    const title = plain(r.name);
    if (!title) { skip('no title'); continue; }

    const description = plain(r.long_desc) || plain(r.short_desc) || title;

    /* compare_price is MSRP. Google wants the regular price in `price` and
       the discounted one in `sale_price` — inverting these advertises the
       wrong number and is the kind of error that is only caught by a
       customer. */
    const compare = Number(r.compare_price);
    const onSale = Number.isFinite(compare) && compare > price;

    const gtin = toGtin(r.upc);
    const mpn = txt(r.mpn);

    const qty = Number(r.qty_on_hand) || 0;
    const availability = qty > 0
      ? 'in_stock'
      : (Number(r.allow_backorder) ? 'backorder' : 'out_of_stock');

    const shipWeight = Number(r.total_ship_weight_lbs) || Number(r.weight_lbs) || null;

    items.push({
      id: sku,
      title: title.slice(0, 150),
      description: description.slice(0, 5000),
      link: `${CANON}/products/${slug}`,
      imageLink: imgs[0],
      additionalImages: imgs.slice(1, 11),   // Google caps at 10 extras
      availability,
      price: (onSale ? compare : price).toFixed(2),
      salePrice: onSale ? price.toFixed(2) : null,
      brand: txt(r.brand),
      gtin,
      mpn: mpn || null,
      identifierExists: Boolean(gtin || mpn),
      condition: txt(r.google_condition) || 'new',
      googleProductCategory: category,
      productType: type,
      shippingWeight: shipWeight ? `${shipWeight.toFixed(2)} lb` : null,
      shippingLabel: txt(r.shipping_label) || null,
      color: txt(r.color) || null,
      material: txt(r.material) || null,
      pattern: txt(r.pattern) || null,
      itemGroupId: txt(r.vendor_group_id) || null,
      excludedDestinations: excl ? excl.split(',').map((s) => s.trim()).filter(Boolean) : [],
      customLabels: [r.custom_label_0, r.custom_label_1, r.custom_label_2,
                     r.custom_label_3, r.custom_label_4].map(txt),
    });
  }

  return { items, skipped, scanned: rows.length };
}

/* ═══ rendering ═════════════════════════════════════════════════════════ */

function itemXml(it) {
  const t = [];
  const add = (tag, val) => { if (val != null && val !== '') t.push(`      <${tag}>${esc(val)}</${tag}>`); };

  add('g:id', it.id);
  add('title', it.title);
  add('description', it.description);
  add('link', it.link);
  add('g:image_link', it.imageLink);
  for (const u of it.additionalImages) add('g:additional_image_link', u);
  add('g:availability', it.availability);
  add('g:price', `${it.price} USD`);
  if (it.salePrice) add('g:sale_price', `${it.salePrice} USD`);
  add('g:brand', it.brand);
  add('g:condition', it.condition);
  add('g:google_product_category', it.googleProductCategory);
  add('g:product_type', it.productType);

  if (it.gtin) add('g:gtin', it.gtin);
  if (it.mpn) add('g:mpn', it.mpn);
  /* Only ever emitted as false, and only when there is genuinely no
     identifier. Sending identifier_exists=false while also sending a gtin is
     contradictory and Google rejects the item. */
  if (!it.identifierExists) add('g:identifier_exists', 'no');

  add('g:shipping_weight', it.shippingWeight);
  add('g:shipping_label', it.shippingLabel);
  add('g:color', it.color);
  add('g:material', it.material);
  add('g:pattern', it.pattern);
  add('g:item_group_id', it.itemGroupId);
  for (const d of it.excludedDestinations) add('g:excluded_destination', d);
  it.customLabels.forEach((v, i) => add(`g:custom_label_${i}`, v));

  return `    <item>\n${t.join('\n')}\n    </item>`;
}

function renderXml({ items, skipped, scanned }) {
  const skipLines = Object.entries(skipped)
    .sort((a, b) => b[1] - a[1])
    .map(([why, n]) => `       ${String(n).padStart(6)}  ${why}`)
    .join('\n');

  /* The build summary rides inside the feed on purpose. When Google's item
     count disagrees with ours, this is the first place to look, and it is
     visible by opening the URL — no logs, no shell, no deploy. */
  const header = `<!--
  BathroomVanitiesOutlet.com product feed
  generated ${new Date().toISOString()}
  scanned  ${scanned} active products
  included ${items.length}
  skipped  ${scanned - items.length}
${skipLines || '       (none)'}
-->`;

  return `<?xml version="1.0" encoding="UTF-8"?>
${header}
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>BathroomVanitiesOutlet.com</title>
    <link>${CANON}</link>
    <description>Premium bathroom vanities at outlet prices</description>
${items.map(itemXml).join('\n')}
  </channel>
</rss>`;
}

/* ═══ the route ═════════════════════════════════════════════════════════ */

exports.googleShopping = async (req, res) => {
  try {
    const fresh = _cache.xml && (Date.now() - _cache.builtAt) < CACHE_TTL_MS;
    if (!fresh) {
      const built = await buildItems();
      _cache = { xml: renderXml(built), builtAt: Date.now(), stats: built };
    }
    res.set('Content-Type', 'application/xml; charset=utf-8');
    /* The feed must never be indexed. It is a machine endpoint listing every
       price in the catalogue; a search result pointing at it is worthless to
       a shopper and hands the whole price list to anyone who finds it. */
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.send(_cache.xml);
  } catch (err) {
    console.error('[Feed] google-shopping failed:', err.message);
    /* A 500 is correct here. Serving an empty but valid feed would read to
       Google as "the merchant sold nothing today" and expire every item. */
    res.status(500).set('Content-Type', 'text/plain').send('feed temporarily unavailable');
  }
};

exports.buildItems = buildItems;
exports.renderXml = renderXml;
exports.toGtin = toGtin;
exports.CANON = CANON;
