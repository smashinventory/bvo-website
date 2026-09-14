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
/* Finish -> swatch family. The same module the JM importer uses, so an HB
   Chrome swatch and a JM Chrome swatch are the same grey. normalize() does
   substring matching longest-first, which is what carries HB's PVD prefix:
   'PVD Satin Nickel' -> nickel, 'PVD Satin Brass' -> gold. */
const { normalize: normalizeFinish } = require('../config/colorFamilies');

/* ── Environment ─────────────────────────────────────────────────────
   src/config/database.js reads process.env.DB_PASS and calls process.exit
   if it is missing — but it never loads dotenv itself. Only src/server.js
   does that. So anything run standalone (`node src/jobs/…`) starts with no
   environment and dies with "DB_PASS is not set in .env" even when the file
   is sitting right there with a valid password. That is exactly what
   happened on the first --live attempt, 2026-09-14.

   The candidate list and the reasoning behind it belong to
   src/jobs/shipmentStatusPoll.js, which hit this on 2026-09-02 and
   documents WHY the paths are what they are: hPanel injects variables into
   the managed app process, cron inherits none of that, and the values
   materialise in a file outside hbuilds/current/ so deploys cannot
   overwrite them. Read that file before changing these paths — it is the
   authority, this is a copy.

   Duplicated rather than shared on purpose, for now: extracting it means
   editing a working production cron job, which is not this task. The
   duplication is logged as something to collapse later.

   Unlike shipmentStatusPoll, a failure here is NOT fatal at load time. A
   dry run touches no database and must work on a laptop with no
   credentials. The error is raised in the write path instead. */
const BVO_BASE = '/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com';
const ENV_CANDIDATES = [
  process.env.BVO_ENV_PATH,                       // explicit override wins
  `${BVO_BASE}/hbuilds/config/.env`,              // survives deploys
  `${BVO_BASE}/hbuilds/current/nodejs/.env`,      // if a deploy symlinks it in
  path.resolve(__dirname, '../../.env'),          // local/dev checkout
].filter(Boolean);

let ENV_LOADED_FROM = null;
for (const candidate of ENV_CANDIDATES) {
  if (!fs.existsSync(candidate)) continue;
  require('dotenv').config({ path: candidate });
  if (process.env.DB_PASS) { ENV_LOADED_FROM = candidate; break; }
}

/* The pool is required LAZILY, inside the write path only.
   database.js exits the process when DB_PASS is unset, so a top-level
   require would make a dry run demand production credentials and make this
   file impossible to unit test. Nothing above the write path may reference
   bvoPool. */
function getPool() {
  if (!ENV_LOADED_FROM) {
    const looked = ENV_CANDIDATES
      .map(c => `     ${c}  ${fs.existsSync(c) ? '(exists, no DB_PASS)' : '(missing)'}`)
      .join('\n');
    throw new Error(
      'no .env yielded DB_PASS, so the database cannot be reached. Looked in:\n' +
      looked + '\n' +
      '   Set BVO_ENV_PATH to the right file, or run the dry run instead (omit --live).');
  }
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

/* ── product_type overrides, by SKU ───────────────────────────────────
   The workbook's Category column becomes product_type (Sam's call), and
   for 763 of 768 rows that is right. These five are not: HB files them
   under "Bathroom Faucets" but their own copy calls them otherwise —

     W9110501     "dual handle bar faucet … addition to the bar"
     W9120601-10  "dual handle bar faucet"
     W9120629-10  "dual handle bar faucet"
     W9510501-30  "laundry faucet … addition to the laundry room"
     W9510501-40  "laundry faucet … addition to the laundry room"

   They are still faucets and still belong in the `faucets` category —
   only the type is wrong. Left alone they appear in step 4 of the bundle
   builder as candidate vanity faucets, which is how this was found.

   This override exists because the DB fix alone would not hold: the next
   import reads Category from the workbook and would put them straight
   back. Data fix plus importer fix, or neither. */
const PRODUCT_TYPE_OVERRIDE_BY_SKU = {
  'W9110501':    'Bar Faucets',
  'W9120601-10': 'Bar Faucets',
  'W9120629-10': 'Bar Faucets',
  'W9510501-30': 'Laundry Faucets',
  'W9510501-40': 'Laundry Faucets',
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
      productType:  PRODUCT_TYPE_OVERRIDE_BY_SKU[sku] || hbCat,  // Sam: Category becomes Type
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

/* Strip a trailing series suffix: W4680201-4 -> W4680201, P0112401-JB ->
   P0112401. A part number with no dash is returned unchanged. */
const baseOf = s => String(s || '').replace(/-[A-Z0-9]+$/, '');

/* ── Why a base-number fallback is safe here ─────────────────────────
   HB's Builder Series carries a -JB suffix on its VARIANT SKUs that the
   price list does not use. Measured 2026-09-14: of 5 workbook rows with no
   exact match, 4 had a -JB counterpart in the feed.

   Loose matching is normally how you put a chrome photo on a matte black
   page. It cannot do that here, because the FINISH IS ENCODED IN THE BASE
   PART NUMBER, not in the suffix:

       P0112401  Chrome           W4680201-4   Chrome
       P0112416  PVD Satin Brass  W4680216-4   PVD Satin Brass
       P0112429  Satin Nickel     W4680229-4   Satin Nickel
       P0112449  Matte Black      W4680249-4   Matte Black

   So P0112401 can only ever base-match P0112401-JB — same product, same
   finish. The suffix distinguishes the series, which the price list
   expresses in a different column.

   Guarded anyway: a base is only used when EXACTLY ONE feed SKU has it. If
   two did, we could not tell which, and a guess is worse than a gap. Every
   fallback match is reported as matchedVia:'base' so a run always shows how
   many rows leaned on this rather than hiding it inside the total. */
function buildBaseIndex(bySku) {
  const byBase = new Map();
  for (const sku of bySku.keys()) {
    const b = baseOf(sku);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(sku);
  }
  return byBase;
}

function joinRows(rows, bySku) {
  const byBase = buildBaseIndex(bySku);
  const matched = [];
  const unmatched = [];

  for (const r of rows) {
    /* 1. Exact SKU. Always preferred. */
    const exact = bySku.get(r.sku);
    if (exact && exact.primaryImage) {
      matched.push({ ...r, feed: exact, matchedVia: 'exact', matchedSku: r.sku });
      continue;
    }

    /* 2. Base part number, only when unambiguous. */
    const candidates = byBase.get(baseOf(r.sku)) || [];
    if (candidates.length === 1) {
      const altSku = candidates[0];
      const alt = bySku.get(altSku);
      if (alt && alt.primaryImage) {
        matched.push({ ...r, feed: alt, matchedVia: 'base', matchedSku: altSku });
        continue;
      }
    }

    /* Be precise about WHY. "not in feed" sends someone to look for a
       product that is there; "no image" sends them to the right place. */
    let reason;
    if (exact)                     reason = 'in feed but no variant image';
    else if (candidates.length > 1) reason = `ambiguous base — feed has ${candidates.join(', ')}`;
    else if (candidates.length === 1) reason = `in feed as ${candidates[0]} but that variant has no image`;
    else                            reason = 'not in feed';
    unmatched.push({ ...r, reason });
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
   ("Sevaun Widespread"). Prefer theirs, qualify with the finish.

   That same series title is ALSO the model. products.model is what
   groupByModel() in bundleController keys on, and what the bundle-builder
   carousel treats as one card with a finish swatch per SKU. Leaving it
   NULL does not fail loudly — every row falls into the `|| 'Other'`
   bucket, so all 768 HB products collapse into a single carousel card
   called "Other" whose "finish" swatches are 768 unrelated products.
   That is exactly what shipped on 2026-09-13 and it looked like a
   filtering bug. Write the model. */
function buildModel(r) {
  const base = (r.feed && r.feed.shopifyTitle) ? r.feed.shopifyTitle.trim()
             : String(r.name || '').trim();
  return base.replace(/\s+/g, ' ') || null;
}

function buildName(r) {
  const pretty = buildModel(r) || '';
  return r.finish ? `${pretty} — ${r.finish}` : pretty;
}

/* 'metal' context, not 'all': in the shared map 'Matte Black' resolves to
   the cabinet family. A faucet finish is never a cabinet finish. */
function buildColorFamily(r) {
  return r.finish ? normalizeFinish(r.finish, 'metal') : null;
}

async function upsertOne(conn, r, categoryId) {
  const name      = buildName(r);
  const model     = buildModel(r);
  const colorFam  = buildColorFamily(r);
  const shortDesc = r.bullets.length ? r.bullets[0].slice(0, 500) : null;
  const longDesc  = [r.feed.longText, r.bullets.map(b => `• ${b}`).join('\n')]
                      .filter(Boolean).join('\n\n') || null;

  await conn.query(`
    INSERT INTO products
      (category_id, product_type, sku, slug, name, model, brand, short_desc, long_desc,
       price, compare_price, color, color_family, upc, weight_lbs, width_in, depth_in,
       height_in, primary_image_url, source_flag, is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,1)
    ON DUPLICATE KEY UPDATE
      category_id       = VALUES(category_id),
      product_type      = VALUES(product_type),
      name              = VALUES(name),
      model             = VALUES(model),
      brand             = VALUES(brand),
      short_desc        = VALUES(short_desc),
      long_desc         = VALUES(long_desc),
      price             = VALUES(price),
      /* compare_price is NOT in this list, deliberately. HB products are
         sold at list, and a previous manual edit should not be wiped by a
         re-import either. */
      color             = VALUES(color),
      color_family      = VALUES(color_family),
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
    categoryId, r.productType, r.sku, slugify(r.sku), name, model, BRAND,
    shortDesc, longDesc, r.price, r.finish || null, colorFam, r.upc,
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

/* ── SQL emitter ────────────────────────────────────────────────────
   Writes a .sql file to run through phpMyAdmin instead of connecting.

   Why this exists: the production credentials live in hbuilds/config/.env
   ON THE SERVER. The repo's .env is a dev template (DB_HOST=localhost,
   DB_NAME=bvo_website), so --live cannot work from a laptop — it would try
   to reach a MySQL that is not there. This path needs no database
   connection at all: the workbook and the Shopify feed are both reachable
   locally, and phpMyAdmin does the writing.

   It also means the statements can be read before they run, which for 768
   products on a live catalogue is worth more than the convenience of a
   direct connection.

   Two things the emitter must get right:

   1. category_id is resolved with a SUBSELECT on the slug, not a hardcoded
      number. Ids differ between environments and a wrong one would file
      768 products under whatever category happens to hold that id.

   2. product_images rows are inserted with INSERT..SELECT keyed on the
      product's SKU, because the product id is not known until the products
      INSERT has run. The DELETE ahead of them is scoped the same way. */

/* MySQL string literal. Escapes the five characters that can break out of
   a quoted string or corrupt the statement. NULL for empty values so the
   column keeps its NULL semantics rather than storing ''. */
function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return "'" + String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/\x00/g, '') + "'";
}
const sqlNum = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)))
  ? 'NULL' : String(Number(v));

function buildSql(matched, { generatedAt = new Date().toISOString() } = {}) {
  const L = [];
  const skus = matched.map(m => sqlStr(m.sku)).join(', ');

  L.push(`-- ═══════════════════════════════════════════════════════════════`);
  L.push(`--  Huntington Brass catalogue import`);
  L.push(`--  generated ${generatedAt}`);
  L.push(`--  ${matched.length} products`);
  L.push(`--`);
  L.push(`--  price = 2026 list price. compare_price stays NULL — HB sells at`);
  L.push(`--  list; discounting happens in the cart, the trade programme and`);
  L.push(`--  the bundle builder.`);
  L.push(`--`);
  L.push(`--  Safe to re-run: products upsert on the UNIQUE sku, and the image`);
  L.push(`--  rows are deleted before being re-inserted.`);
  L.push(`--`);
  L.push(`--  Wrapped in a transaction. If any statement fails, ROLLBACK and`);
  L.push(`--  nothing is written. phpMyAdmin stops on the first error.`);
  L.push(`-- ═══════════════════════════════════════════════════════════════`);
  L.push('');
  L.push('START TRANSACTION;');
  L.push('');

  /* Fail loudly and early if the categories are missing, rather than
     inserting 768 rows with a NULL category_id. */
  L.push(`-- Abort unless both categories exist. Returns an error row if not.`);
  L.push(`SELECT IF(COUNT(*) = 2, 'ok',`);
  L.push(`  (SELECT CONCAT('ABORT: expected categories faucets+accessories, found ', COUNT(*))`);
  L.push(`     FROM categories WHERE slug IN ('faucets','accessories'))) AS precheck`);
  L.push(`  FROM categories WHERE slug IN ('faucets','accessories');`);
  L.push('');

  for (const r of matched) {
    const name      = buildName(r);
    const model     = buildModel(r);
    const colorFam  = buildColorFamily(r);
    const shortDesc = r.bullets.length ? r.bullets[0].slice(0, 500) : null;
    const longDesc  = [r.feed.longText, r.bullets.map(b => `• ${b}`).join('\n')]
                        .filter(Boolean).join('\n\n') || null;

    L.push(`INSERT INTO products`);
    L.push(`  (category_id, product_type, sku, slug, name, model, brand, short_desc, long_desc,`);
    L.push(`   price, compare_price, color, color_family, upc, weight_lbs, width_in, depth_in,`);
    L.push(`   height_in, primary_image_url, source_flag, is_active)`);
    L.push(`VALUES ((SELECT id FROM categories WHERE slug = ${sqlStr(r.categorySlug)}),`);
    L.push(`  ${sqlStr(r.productType)}, ${sqlStr(r.sku)}, ${sqlStr(slugify(r.sku))},`);
    L.push(`  ${sqlStr(name)}, ${sqlStr(model)}, ${sqlStr(BRAND)}, ${sqlStr(shortDesc)}, ${sqlStr(longDesc)},`);
    L.push(`  ${sqlNum(r.price)}, NULL, ${sqlStr(r.finish)}, ${sqlStr(colorFam)}, ${sqlStr(r.upc)},`);
    L.push(`  ${sqlNum(r.weightLbs)}, ${sqlNum(r.widthIn)}, ${sqlNum(r.depthIn)}, ${sqlNum(r.heightIn)},`);
    L.push(`  ${sqlStr(r.feed.primaryImage)}, ${sqlStr(SOURCE_FLAG)}, 1)`);
    L.push(`ON DUPLICATE KEY UPDATE`);
    L.push(`  category_id = VALUES(category_id), product_type = VALUES(product_type),`);
    L.push(`  name = VALUES(name), model = VALUES(model), brand = VALUES(brand),`);
    L.push(`  short_desc = VALUES(short_desc), long_desc = VALUES(long_desc),`);
    L.push(`  price = VALUES(price), color = VALUES(color),`);
    L.push(`  color_family = VALUES(color_family),`);
    L.push(`  upc = COALESCE(upc, VALUES(upc)), weight_lbs = VALUES(weight_lbs),`);
    L.push(`  width_in = VALUES(width_in), depth_in = VALUES(depth_in),`);
    L.push(`  height_in = VALUES(height_in), primary_image_url = VALUES(primary_image_url);`);
    L.push('');
  }

  /* Images: clear then repopulate, scoped to the SKUs in this file so no
     other brand's images are touched. */
  L.push(`-- Replace image rows for these SKUs only.`);
  L.push(`DELETE pi FROM product_images pi`);
  L.push(`  JOIN products p ON p.id = pi.product_id`);
  L.push(` WHERE p.sku IN (${skus});`);
  L.push('');

  for (const r of matched) {
    const name = buildName(r);
    const urls = [r.feed.primaryImage,
                  ...r.feed.gallery.filter(u => u !== r.feed.primaryImage)];
    urls.forEach((url, i) => {
      L.push(`INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)`);
      L.push(`  SELECT p.id, ${sqlStr(url)}, ${sqlStr(name)}, ${i}, ${i === 0 ? 1 : 0}`);
      L.push(`    FROM products p WHERE p.sku = ${sqlStr(r.sku)};`);
    });
  }

  L.push('');
  L.push('COMMIT;');
  L.push('');
  L.push(`-- Verify — expect ${matched.length}:`);
  L.push(`-- SELECT COUNT(*) FROM products WHERE brand = 'Huntington Brass' AND source_flag = 'csv';`);
  L.push(`-- Undo, if needed:`);
  L.push(`-- DELETE FROM products WHERE brand = 'Huntington Brass' AND source_flag = 'csv';`);
  return L.join('\n');
}

/* ── Orchestration ──────────────────────────────────────────────────── */

async function run({ file, dryRun = true, sqlOut = null, log = console.log } = {}) {
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
  const viaBase = matched.filter(m => m.matchedVia === 'base');
  log(`\nmatched to an image : ${matched.length}`);
  log(`   exact SKU        : ${matched.length - viaBase.length}`);
  log(`   base part number : ${viaBase.length}`);
  log(`unmatched           : ${unmatched.length}`);

  /* Always list the fallback matches. They are correct, but they are an
     inference, and an inference that is never shown is one nobody checks. */
  if (viaBase.length) {
    log('\nmatched on base part number (suffix differs):');
    for (const m of viaBase.slice(0, 20)) {
      log(`   ${m.sku.padEnd(16)} -> feed ${m.matchedSku}   [${m.finish}]`);
    }
    if (viaBase.length > 20) log(`   … and ${viaBase.length - 20} more`);
  }

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

  /* --sql: write statements to a file instead of connecting. Checked
     BEFORE the dryRun branch so --sql works on its own; it is a dry run as
     far as the database is concerned. */
  if (sqlOut) {
    const sql = buildSql(matched);
    fs.writeFileSync(sqlOut, sql, 'utf8');
    const kb = Math.round(Buffer.byteLength(sql, 'utf8') / 1024);
    log(`\nSQL written: ${sqlOut}  (${kb} KB, ${matched.length} products)`);
    log(`Nothing was written to any database.`);
    log(`\nImport it in phpMyAdmin — Import tab, choose the file, Go.`);
    log(`It runs inside a transaction, so a failure rolls the whole thing back.`);
    return { matched: matched.length, unmatched: unmatched.length, written: 0,
             sqlFile: sqlOut, unmatchedRows: unmatched };
  }

  if (dryRun) {
    log(`\nDRY RUN — would upsert ${matched.length} products. Nothing written.`);
    /* Say up front whether --live would even be able to connect. Finding
       that out only after a 30-second feed fetch, having already decided to
       go live, is how the first attempt went. */
    log(ENV_LOADED_FROM
      ? `(--live would use credentials from ${ENV_LOADED_FROM})`
      : `(--live would FAIL here: no .env on this machine yields DB_PASS)`);
    return { matched: matched.length, unmatched: unmatched.length, written: 0, unmatchedRows: unmatched };
  }

  log(`\nenv loaded from: ${ENV_LOADED_FROM || '(none)'}`);

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
  run, readWorkbook, joinRows, fetchShopifyFeed, baseOf, buildBaseIndex, buildSql, sqlStr,
  buildName, parseBullets, htmlToText, normSku, slugify,
  CATEGORY_SLUG_BY_HB_CATEGORY, HB_IMAGE_HOST,
};

/* ── CLI ────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const sqlArg = args.find(a => a.startsWith('--sql'));
  /* --sql            -> default filename next to the workbook
     --sql=path.sql   -> explicit */
  const sqlOut = sqlArg
    ? (sqlArg.includes('=') ? sqlArg.split('=').slice(1).join('=')
                            : 'huntington_brass_import.sql')
    : null;
  const file   = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node src/jobs/importHuntingtonBrass.js <workbook.xlsx> [--live|--sql[=out.sql]]');
    console.error('  (no flag)        dry run — reports what it would do, writes nothing');
    console.error('  --sql[=out.sql]  write a .sql file to import via phpMyAdmin');
    console.error('  --live           connect and write directly (server only)');
    process.exit(2);
  }
  run({ file, dryRun, sqlOut })
    .then(r => { console.log('\ndone:', JSON.stringify({ matched: r.matched, unmatched: r.unmatched, written: r.written })); process.exit(0); })
    .catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
}
