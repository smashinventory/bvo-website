'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   Huntington Brass importer

   Two sources, joined on the catalogue part number:

     1. The HB price-list workbook  — SKU, category, name, description,
        finish, 2026 list price, UPC, dimensions, weights.
     2. huntingtonbrass.com/products.json — images and marketing copy.
        Their storefront is Shopify, so this is a public structured feed;
        there is no HTML scraping anywhere in this file.

   PRICING — decided by Sam 2026-09-14:
     price          = the 2026 list price (MSRP). This is the selling price.
     compare_price  = NULL. No "was" price, no savings badge.
   HB's pricing rules permit a discount shown in the cart, and BVO's trade
   programme and bundle builder handle discounting. None of that belongs
   here. Do not populate compare_price from the list price to manufacture a
   saving — it would be the same number twice and reads as a fake discount.

   CATEGORIES — decided by Sam 2026-09-14:
     Everything lands in exactly two existing categories, and the
     workbook's own Category column becomes product_type:

       faucets      <- Bathroom Faucets, Kitchen Faucets, Tub Fillers,
                       Shower Fixtures                         (669 rows)
       accessories  <- Bathroom Accessories, Plumbing Accessories (100 rows)

   IMAGES — interim, decided by Sam 2026-09-14:
     Image URLs point at HB's cdn.shopify.com. That is hotlinking, which is
     logged as a cutover blocker in OPEN_ITEMS §6 for a different set of
     images. It is deliberate here and temporary: the CDN project will fetch
     and re-host. HB_IMAGE_HOST below is the single seam for that swap.

   Run with --dry-run first. It writes nothing and prints what it would do.
   ═══════════════════════════════════════════════════════════════════════ */

const path  = require('path');
const fs    = require('fs');
const XLSX  = require('xlsx');
const axios = require('axios');

/* The pool is required LAZILY, inside the write path only.
   src/config/database.js exits the process when DB_PASS is unset, so a
   top-level require would make a dry run — which touches no database —
   demand production credentials, and make this file impossible to unit
   test. Nothing above the write path may reference bvoPool. */
function getPool() {
  return require('../config/database').bvoPool;
}

/* ── Constants ──────────────────────────────────────────────────────── */

const BRAND        = 'Huntington Brass';
const HB_SHOP      = 'https://www.huntingtonbrass.com';
const HB_IMAGE_HOST = 'cdn.shopify.com';   // the seam for the CDN migration
const SOURCE_FLAG  = 'csv';                // products.source_flag enum member

/* Workbook Category -> BVO category slug. Sam's mapping, 2026-09-14.
   An unrecognised category is a HARD FAIL, not a default. A new HB category
   silently landing in `accessories` is exactly the kind of quiet wrong that
   nobody notices until a customer does. */
const CATEGORY_SLUG_BY_HB_CATEGORY = {
  'Bathroom Faucets':     'faucets',
  'Kitchen Faucets':      'faucets',
  'Tub Fillers':          'faucets',
  'Shower Fixtures':      'faucets',
  'Bathroom Accessories': 'accessories',
  'Plumbing Accessories': 'accessories',
};

/* Workbook column headers, exactly as they appear in row 1. Trailing space
   on the carton-weight header is real — do not "tidy" it. */
const COL = {
  sku:         'Catalog Part number',
  category:    'Category',
  name:        'Product name',
  description: 'Description',
  finish:      'Finish',
  price:       '2026 List Price',
  upc:         'Upc code',
  h:           'H(IN)',
  w:           'W(IN)',
  l:           'L(IN)',
  weight:      'Product weight (LB)',
};

/* ── Helpers ────────────────────────────────────────────────────────── */

const slugify = s => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* The workbook's part numbers carry trailing spaces ("K1963401-J "). The
   Shopify feed's do not. Every comparison goes through this. */
const normSku = s => String(s == null ? '' : s).trim().toUpperCase();

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/* HB's description column is a newline-separated bullet list that starts
   each line with "•". Split it into clean bullet strings. */
function parseBullets(desc) {
  return String(desc || '')
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*[•·*-]\s*/, '').trim())
    .filter(Boolean);
}

/* Shopify body_html is their markup. We take the text, not the tags —
   pasting a vendor's HTML into our pages imports their styling, their
   inline <table> layouts and their PDF-icon images. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .trim();
}

/* ── 1. Read the workbook ───────────────────────────────────────────── */

function readWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const out = [];
  const problems = [];

  rows.forEach((r, i) => {
    const rowNo = i + 2;                       // +1 header, +1 to 1-base
    const sku   = normSku(r[COL.sku]);
    if (!sku) { problems.push({ rowNo, why: 'no part number' }); return; }

    const hbCat = String(r[COL.category] || '').trim();
    const slug  = CATEGORY_SLUG_BY_HB_CATEGORY[hbCat];
    if (!slug) {
      problems.push({ rowNo, sku, why: `unmapped Category "${hbCat}"` });
      return;
    }

    const price = num(r[COL.price]);
    if (price === null || price <= 0) {
      problems.push({ rowNo, sku, why: `unusable price "${r[COL.price]}"` });
      return;
    }

    out.push({
      sku,
      hbCategory:   hbCat,
      categorySlug: slug,
      productType:  hbCat,                      // Sam: Category becomes Type
      name:         String(r[COL.name] || '').trim(),
      finish:       String(r[COL.finish] || '').trim(),
      bullets:      parseBullets(r[COL.description]),
      price,
      upc:          r[COL.upc] ? String(r[COL.upc]).trim() : null,
      heightIn:     num(r[COL.h]),
      widthIn:      num(r[COL.w]),
      depthIn:      num(r[COL.l]),
      weightLbs:    num(r[COL.weight]),
      rowNo,
    });
  });

  return { rows: out, problems };
}

/* ── 2. Fetch the Shopify feed ──────────────────────────────────────── */

/* Paged. Shopify caps limit at 250 and returns an empty array past the end.
   MAX_PAGES is a guard against an endpoint that never returns empty —
   without it a change at their end turns this into an infinite loop against
   a third party, which is a bad way to lose access. */
const MAX_PAGES = 20;

async function fetchShopifyFeed({ log = console.log } = {}) {
  const bySku = new Map();
  let products = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${HB_SHOP}/products.json?limit=250&page=${page}`;
    const res = await axios.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': 'BVO-catalogue-sync/1.0 (+https://bathroomvanitiesoutlet.com)' },
    });
    const list = (res.data && res.data.products) || [];
    if (!list.length) break;
    products += list.length;

    for (const p of list) {
      const longText = htmlToText(p.body_html);
      for (const v of (p.variants || [])) {
        const sku = normSku(v.sku);
        if (!sku) continue;

        /* Prefer the variant's own image — it is the correct finish. Falling
           back to images[0] would show a chrome faucet on the matte black
           page, which is worse than no image. */
        const primary = v.featured_image && v.featured_image.src ? v.featured_image.src : null;

        /* Gallery: the product's shared shots, minus other finishes' images
           and minus the spec-sheet scans, which are documents not photos. */
        const gallery = (p.images || [])
          .filter(img => !img.variant_ids || img.variant_ids.length === 0)
          .filter(img => !/-spec\b/i.test(img.src))
          .map(img => img.src);

        bySku.set(sku, {
          primaryImage: primary,
          gallery,
          longText,
          shopifyHandle: p.handle,
          shopifyTitle:  p.title,
        });
      }
    }
    log(`   feed page ${page}: ${list.length} products (${bySku.size} SKUs so far)`);
    if (list.length < 250) break;
  }

  return { bySku, products };
}

/* ── 3. Join ────────────────────────────────────────────────────────── */

function joinRows(rows, bySku) {
  const matched = [];
  const unmatched = [];
  for (const r of rows) {
    const feed = bySku.get(r.sku);
    if (feed && feed.primaryImage) matched.push({ ...r, feed });
    else unmatched.push({ ...r, reason: feed ? 'in feed but no variant image' : 'not in feed' });
  }
  return { matched, unmatched };
}

/* ── 4. Write ───────────────────────────────────────────────────────── */

async function resolveCategoryIds(conn) {
  const slugs = [...new Set(Object.values(CATEGORY_SLUG_BY_HB_CATEGORY))];
  const [rows] = await conn.query(
    `SELECT id, slug FROM categories WHERE slug IN (${slugs.map(() => '?').join(',')})`, slugs);
  const map = new Map(rows.map(r => [r.slug, r.id]));
  const missing = slugs.filter(s => !map.has(s));
  if (missing.length) {
    throw new Error(
      `categories missing from the database: ${missing.join(', ')}. ` +
      `Create them before importing — this importer will not invent a category.`);
  }
  return map;
}

/* Product name: the workbook's "Product name" is a bare type ("KITCHEN
   FAUCET", "TOWEL BAR") repeated across every series and finish, so it is
   useless as a title on its own. Shopify's title carries the series name
   ("Sevaun Widespread"). Prefer theirs, qualify with the finish. */
function buildName(r) {
  const base = (r.feed && r.feed.shopifyTitle) ? r.feed.shopifyTitle.trim()
             : String(r.name || '').trim();
  const pretty = base.replace(/\s+/g, ' ');
  return r.finish ? `${pretty} — ${r.finish}` : pretty;
}

async function upsertOne(conn, r, categoryId) {
  const name      = buildName(r);
  const shortDesc = r.bullets.length ? r.bullets[0].slice(0, 500) : null;
  const longDesc  = [r.feed.longText, r.bullets.map(b => `• ${b}`).join('\n')]
                      .filter(Boolean).join('\n\n') || null;

  await conn.query(`
    INSERT INTO products
      (category_id, product_type, sku, slug, name, brand, short_desc, long_desc,
       price, compare_price, color, upc, weight_lbs, width_in, depth_in, height_in,
       primary_image_url, source_flag, is_active)
    VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,1)
    ON DUPLICATE KEY UPDATE
      category_id       = VALUES(category_id),
      product_type      = VALUES(product_type),
      name              = VALUES(name),
      brand             = VALUES(brand),
      short_desc        = VALUES(short_desc),
      long_desc         = VALUES(long_desc),
      price             = VALUES(price),
      /* compare_price is NOT in this list, deliberately. HB products are
         sold at list, and a previous manual edit should not be wiped by a
         re-import either. */
      color             = VALUES(color),
      upc               = COALESCE(upc, VALUES(upc)),
      weight_lbs        = VALUES(weight_lbs),
      width_in          = VALUES(width_in),
      depth_in          = VALUES(depth_in),
      height_in         = VALUES(height_in),
      primary_image_url = VALUES(primary_image_url)
      /* updated_at intentionally absent — see importJamesMartinFeed.js.
         The column is ON UPDATE CURRENT_TIMESTAMP and fires only on a real
         change; setting it here bumps every row on every run and turns
         sitemap lastmod into noise. */
  `, [
    categoryId, r.productType, r.sku, slugify(r.sku), name, BRAND,
    shortDesc, longDesc, r.price, r.finish || null, r.upc,
    r.weightLbs, r.widthIn, r.depthIn, r.heightIn,
    r.feed.primaryImage, SOURCE_FLAG,
  ]);

  const [[row]] = await conn.query('SELECT id FROM products WHERE sku = ?', [r.sku]);
  if (!row) throw new Error(`insert reported success but ${r.sku} is not readable`);
  const productId = row.id;

  /* Images: replace wholesale. Merging would accumulate stale URLs every
     time HB re-shoots a product. */
  await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
  const urls = [r.feed.primaryImage, ...r.feed.gallery.filter(u => u !== r.feed.primaryImage)];
  let sort = 0;
  for (const url of urls) {
    await conn.query(
      `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
       VALUES (?,?,?,?,?)`,
      [productId, url, name, sort, sort === 0 ? 1 : 0]);
    sort++;
  }

  return productId;
}

/* ── Orchestration ──────────────────────────────────────────────────── */

async function run({ file, dryRun = true, log = console.log } = {}) {
  if (!file || !fs.existsSync(file)) throw new Error(`workbook not found: ${file}`);

  log(`\nHuntington Brass import  ${dryRun ? '(DRY RUN — nothing will be written)' : '(LIVE)'}`);
  log(`workbook: ${path.basename(file)}\n`);

  const { rows, problems } = readWorkbook(file);
  log(`workbook rows usable: ${rows.length}`);
  if (problems.length) {
    log(`workbook rows skipped: ${problems.length}`);
    for (const p of problems.slice(0, 15)) log(`   row ${p.rowNo} ${p.sku || ''} — ${p.why}`);
    if (problems.length > 15) log(`   … and ${problems.length - 15} more`);
  }

  log(`\nfetching ${HB_SHOP}/products.json …`);
  const { bySku, products } = await fetchShopifyFeed({ log });
  log(`feed: ${products} products, ${bySku.size} SKUs with a variant`);

  const { matched, unmatched } = joinRows(rows, bySku);
  log(`\nmatched to an image : ${matched.length}`);
  log(`unmatched           : ${unmatched.length}`);

  const byCat = {};
  for (const m of matched) byCat[m.hbCategory] = (byCat[m.hbCategory] || 0) + 1;
  log('\nmatched by type:');
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    log(`   ${String(v).padStart(4)}  ${k}  ->  ${CATEGORY_SLUG_BY_HB_CATEGORY[k]}`);
  }

  if (unmatched.length) {
    log('\nunmatched (first 25):');
    for (const u of unmatched.slice(0, 25)) log(`   ${u.sku.padEnd(16)} ${u.reason}  [${u.hbCategory}]`);
    if (unmatched.length > 25) log(`   … and ${unmatched.length - 25} more`);
  }

  if (dryRun) {
    log(`\nDRY RUN — would upsert ${matched.length} products. Nothing written.`);
    return { matched: matched.length, unmatched: unmatched.length, written: 0, unmatchedRows: unmatched };
  }

  const conn = await getPool().getConnection();
  let written = 0;
  try {
    const catIds = await resolveCategoryIds(conn);
    await conn.beginTransaction();
    for (const r of matched) {
      await upsertOne(conn, r, catIds.get(r.categorySlug));
      written++;
      if (written % 100 === 0) log(`   … ${written}/${matched.length}`);
    }
    await conn.commit();
    log(`\nwrote ${written} products.`);
  } catch (err) {
    await conn.rollback();
    log(`\nFAILED after ${written} rows — transaction rolled back. Nothing was written.`);
    throw err;
  } finally {
    conn.release();
  }

  return { matched: matched.length, unmatched: unmatched.length, written, unmatchedRows: unmatched };
}

module.exports = {
  run, readWorkbook, joinRows, fetchShopifyFeed,
  buildName, parseBullets, htmlToText, normSku, slugify,
  CATEGORY_SLUG_BY_HB_CATEGORY, HB_IMAGE_HOST,
};

/* ── CLI ────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const file   = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node src/jobs/importHuntingtonBrass.js <workbook.xlsx> [--live]');
    console.error('       omit --live for a dry run (default)');
    process.exit(2);
  }
  run({ file, dryRun })
    .then(r => { console.log('\ndone:', JSON.stringify({ matched: r.matched, unmatched: r.unmatched, written: r.written })); process.exit(0); })
    .catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
}
