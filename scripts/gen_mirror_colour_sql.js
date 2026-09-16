#!/usr/bin/env node
'use strict';

/**
 * gen_mirror_colour_sql.js — emit a targeted SQL backfill for mirror colours.
 *
 * WHY THIS EXISTS RATHER THAN A RE-IMPORT
 *
 * The colour fix lives in the importer, so the obvious way to apply it is to
 * re-run the importer. That rewrites 5,218 products — price, MAP, inventory,
 * images, bullets, certifications, every EAV key — to populate two columns on
 * 111 mirrors. Sam, 2026-09-16: "Any defect in the importer and the whole
 * website can get buried in errors. All of this to fix 111 products out of
 * almost 6000."
 *
 * He is right about the blast radius. The VALUES do not need the importer —
 * they need colorFamilies.resolveBuckets(), which runs fine here. So this
 * script resolves every mirror colour locally and writes the answers out as
 * literal SQL.
 *
 * WHAT THAT BUYS
 *
 * The generated file contains no logic. No CASE expression, no join to
 * another product to borrow its family, no MIN() tie-break, no regex. Every
 * family key is a literal that came out of resolveBuckets(). The SQL is
 * readable start to finish and does exactly what it says, which is the whole
 * point of doing it this way instead of a 45-minute import.
 *
 * Scope: products.color and products.color_family on category
 * 'bathroom-mirrors', plus the color_family_alt EAV rows. Nothing else.
 *
 * USAGE
 *   node scripts/gen_mirror_colour_sql.js <feed.xlsx> [out.sql]
 *
 * Re-run it whenever the feed changes; the output is disposable.
 */

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { resolveBuckets } = require('../src/config/colorFamilies');

const feedPath = process.argv[2];
const outPath  = process.argv[3]
  || path.join(__dirname, '..', 'migrations', '2026-09-16_mirror_colour_backfill.sql');

if (!feedPath || !fs.existsSync(feedPath)) {
  console.error('usage: node scripts/gen_mirror_colour_sql.js <feed.xlsx> [out.sql]');
  process.exit(1);
}

/* MySQL string literal. Doubling the quote is the standard escape and is not
   affected by NO_BACKSLASH_ESCAPES, unlike \' — worth caring about because
   these strings are vendor colour names we do not control. */
const q = s => "'" + String(s).replace(/'/g, "''") + "'";

const wb = XLSX.readFile(feedPath, { cellDates: false });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Etail Products'], { defval: null });

const clean = v => (v === undefined || v === null) ? null : (String(v).trim() || null);

/* Same precedence as importJamesMartinFeed.js: the vanity column first, the
   general finish column as fallback. Kept identical on purpose — if the two
   ever disagree, the storefront and this script would disagree too. */
const byColour = new Map();
let mirrors = 0;

for (const raw of rows) {
  const row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim(), v]));
  if (clean(row['Product Type']) !== 'Mirror') continue;
  const sku = clean(row['Item Number']);
  const colour = clean(row['Vanity Base Color/Finish'])
              || clean(row['Finish/Color of Product']);
  if (!sku || !colour) continue;
  mirrors++;
  if (!byColour.has(colour)) {
    byColour.set(colour, Object.assign({ skus: [] }, resolveBuckets(colour, 'cabinet')));
  }
  byColour.get(colour).skus.push(sku);
}

const sorted = [...byColour.entries()].sort((a, b) => b[1].skus.length - a[1].skus.length);
const L = [];
const w = s => L.push(s);

w('-- ═══════════════════════════════════════════════════════════════════');
w('--  MIRROR COLOUR BACKFILL');
w('--  Generated ' + new Date().toISOString().slice(0, 10) + ' by scripts/gen_mirror_colour_sql.js');
w('--  Source: ' + path.basename(feedPath));
w('--');
w('--  WHAT THIS TOUCHES');
w('--    products.color          }  on category bathroom-mirrors only');
w('--    products.color_family   }');
w('--    product_attribute_values rows with attr_key = color_family_alt');
w('--');
w('--  Nothing else. No price, no MAP, no inventory, no images, no other');
w('--  EAV key, no other category, no other product type.');
w('--');
w('--  WHERE THE VALUES CAME FROM');
w('--  Every family key below is a literal produced by');
w('--  colorFamilies.resolveBuckets() — the same function the importer uses.');
w('--  There is no CASE, no join to another product, no tie-break and no');
w('--  pattern matching in this file. It applies decisions; it does not make');
w('--  any.');
w('--');
w('--  SAFE TO RE-RUN. The UPDATEs are idempotent and the alt rows are');
w('--  deleted before being re-inserted.');
w('-- ═══════════════════════════════════════════════════════════════════');
w('');
w('SET @mirror_cat := (SELECT id FROM categories WHERE slug = \'bathroom-mirrors\');');
w('');
w('-- Stop here if the slug is wrong, rather than silently updating 0 rows.');
w('-- Run this line on its own first: it must return a number, not NULL.');
w('SELECT @mirror_cat AS mirror_category_id;');
w('');
w('-- ── BEFORE ─────────────────────────────────────────────────────────');
w('SELECT color_family, COUNT(*) AS n');
w('  FROM products');
w(' WHERE category_id = @mirror_cat AND is_active = 1');
w(' GROUP BY color_family ORDER BY n DESC;');
w('');
w('');
w('-- ── 1. COLOUR AND PRIMARY FAMILY ───────────────────────────────────');
w('');

let updated = 0, nulls = 0, altRows = 0, stmts = 0;

for (const [colour, d] of sorted) {
  if (!d.primary) {
    nulls += d.skus.length;
    w('-- ' + colour + '  ->  no family. ' + d.skus.length + ' product(s) deliberately left');
    w('--   NULL; they appear under no colour swatch. Agreed with Sam 2026-09-15:');
    w('--   "If they do not, then they will not appear in any bucket."');
    w('');
    continue;
  }
  updated += d.skus.length;
  stmts++;
  w('-- ' + colour + '  ->  ' + d.primary
    + (d.alt.length ? '   (also shows under ' + d.alt.join(', ') + ')' : '')
    + '   [' + d.skus.length + ' product' + (d.skus.length === 1 ? '' : 's') + ']');
  w('UPDATE products');
  w('   SET color = ' + q(colour) + ', color_family = ' + q(d.primary));
  w(' WHERE category_id = @mirror_cat');
  w('   AND sku IN (' + d.skus.map(q).join(', ') + ');');
  w('');
}

w('');
w('-- ── 2. ADDITIONAL SWATCHES (dual bucket) ───────────────────────────');
w('--');
w('--  Approved by Sam 2026-09-16: a shopper filtering Cream may well want a');
w('--  Champagne Brass mirror, so it appears under both.');
w('--');
w('--  The DELETE runs first so re-running this file cannot double the rows,');
w('--  and so a colour that stops bleeding loses its stale entry.');
w('');
w('DELETE pav');
w('  FROM product_attribute_values pav');
w('  JOIN products p ON p.id = pav.product_id');
w(' WHERE p.category_id = @mirror_cat');
w('   AND pav.attr_key = \'color_family_alt\';');
w('');

for (const [colour, d] of sorted) {
  if (!d.alt.length) continue;
  for (const alt of d.alt) {
    altRows += d.skus.length;
    w('-- ' + colour + ' also shows under ' + alt + '   [' + d.skus.length + ']');
    w('INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)');
    w('SELECT p.id, \'color_family_alt\', ' + q(alt) + ', NULL');
    w('  FROM products p');
    w(' WHERE p.category_id = @mirror_cat');
    w('   AND p.sku IN (' + d.skus.map(q).join(', ') + ');');
    w('');
  }
}

w('');
w('-- ── AFTER — these are the numbers to check ─────────────────────────');
w('--');
w('-- Expect ' + updated + ' mirrors carrying a family and a NULL row of ' + nulls + '.');
w('');
w('SELECT color_family, COUNT(*) AS n');
w('  FROM products');
w(' WHERE category_id = @mirror_cat AND is_active = 1');
w(' GROUP BY color_family ORDER BY n DESC;');
w('');
w('-- Expect ' + altRows + ' rows across the alt families.');
w('');
w('SELECT pav.value_text AS also_shows_under, COUNT(*) AS n');
w('  FROM product_attribute_values pav');
w('  JOIN products p ON p.id = pav.product_id');
w(' WHERE p.category_id = @mirror_cat');
w('   AND pav.attr_key = \'color_family_alt\'');
w(' GROUP BY pav.value_text ORDER BY n DESC;');
w('');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, L.join('\n'));

console.log('written: ' + path.relative(path.join(__dirname, '..'), outPath));
console.log('  mirrors in feed   : ' + mirrors);
console.log('  UPDATE statements : ' + stmts + ', covering ' + updated + ' mirrors');
console.log('  left NULL         : ' + nulls);
console.log('  alt rows inserted : ' + altRows);
