#!/usr/bin/env node
'use strict';

/**
 * scripts/wcDimensionSeed.js — build the wc_dimensions seed from WC catalogues.
 *
 * WHY THIS EXISTS
 * The WC daily inventory feed carries only SKU + available qty + available
 * date. Every attribute we want to report on — collection, cabinet colour,
 * size, top material, sink count — lives in the supplier catalogue, not the
 * feed. This script turns the catalogue into the dimension table the reports
 * join against.
 *
 * THE SUFFIX IS A BILL OF MATERIALS. A WC SKU looks like:
 *
 *     PY30CW03GG-000000000
 *     └─ base ──┘└ suffix ┘
 *
 * base   = collection + size + finish, i.e. the cabinet itself
 * suffix = [mirror: 3 chars][faucet: 6 chars], '000'/'000000' meaning absent
 *
 * So one cabinet appears as many SKUs. A naive GROUP BY sku counts the same
 * cabinet once per option permutation and ranks option-heavy collections far
 * too high. base_sku is what model-level rollups must group on; the full sku
 * is what mirror/faucet attach rates need. Both are emitted.
 *
 * NO PRICING. Scope decision 2026-11-24: the WC reports are units only. The
 * catalogue has Wholesale Cost and MAP columns; they are deliberately NOT
 * read. Do not add them — see docs/briefs/WC_REPORTS_SPEC.md §1.
 *
 * USAGE
 *   node scripts/wcDimensionSeed.js <catalogue.xlsx> [more.xlsx ...]
 *   node scripts/wcDimensionSeed.js --feed-skus <skus.txt> <catalogue.xlsx>
 *
 * The optional --feed-skus file (one SKU per line, e.g. cut from a snapshot)
 * makes the script report real coverage: how many feed SKUs the catalogue can
 * actually describe. Without it, coverage is reported as unknown.
 *
 * OUTPUT (to scripts/out/)
 *   wc_dimensions_seed.sql   — INSERT … ON DUPLICATE KEY UPDATE
 *   wc_dimensions.csv        — same rows, for eyeballing
 */

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const OUT_DIR = path.join(__dirname, 'out');

/* ---------------------------------------------------------------------------
 * Catalogue column map. Indices are 0-based against the HEADER ROW, which in
 * `Product Data - Vanity` is row 2 of the sheet, not row 1 — row 1 holds merged
 * group labels ("Included parts", "Pricing", "Feature Bullets"). Reading row 1
 * as the header is the obvious mistake here and yields a sheet of blanks.
 * ------------------------------------------------------------------------- */
const COL = {
  sku:              0,   // Supplier SKU #  ← the feed's key
  vanity_part:      1,   // e.g. PAISLEY-30GG-CW
  mirror_part:      2,
  faucet_part:      3,
  collection:       6,   // Collection Name
  product_name:    11,
  overall_size:    39,
  height:          40,
  width:           41,   // Overall Width — the size dimension we bucket
  depth:           42,
  top_material:    53,
  top_finish:      56,
  top_color:       57,
  top_edge:        58,
  top_thickness:   59,
  top_width:       61,
  faucet_spacing:  65,
  cabinet_color:   66,
  cabinet_finish:  67,
  cabinet_material:68,
  sinks:           71,
  sink_type:       75,
  sink_shape:      73,
  mirror_included: 98,
  mirror_sku:      97,
  faucet_included: 84,
  faucet_sku:      85,
  faucet_finish:   87,
  mounting:       104,
  doors:          107,
  ada:             30,
};

/* The 2020 catalogue is a different, flatter sheet: Old SKU / New SKU and not
   much else of use. It is read only to widen SKU coverage, never to overwrite
   a richer 2021 row. */
const LEGACY = { old_sku: 0, new_sku: 1, product_name: 5 };

const s = v => (v === null || v === undefined) ? '' : String(v).trim();

/**
 * Split a WC SKU into its cabinet base and its option suffix.
 *
 * Returns { base, mirror, faucet, shape } where shape describes what was
 * actually found, so anomalies are counted rather than silently coerced. Real
 * catalogues are never as uniform as their documentation claims.
 */
function parseSku(sku) {
  const raw = s(sku).toUpperCase();
  if (!raw) return null;

  const dash = raw.indexOf('-');
  if (dash < 0) {
    // No suffix at all. Treat the whole thing as the base; it is its own config.
    return { sku: raw, base: raw, mirror: '', faucet: '', shape: 'no-suffix' };
  }

  const base   = raw.slice(0, dash);
  const suffix = raw.slice(dash + 1);

  if (suffix.length === 9) {
    return {
      sku: raw, base,
      mirror: suffix.slice(0, 3),
      faucet: suffix.slice(3),
      shape: 'std-9',
    };
  }

  // Anything else: keep the base, record the suffix whole, flag the shape so
  // the summary shows how many rows do not match the documented pattern.
  return { sku: raw, base, mirror: '', faucet: '', shape: `len-${suffix.length}` };
}

/** '000' / '000000' / '' all mean "not included". */
const hasOption = code => !!code && !/^0+$/.test(code);

/** Pull a nominal inch size out of a width-ish string ("30", "30 in", "30.00"). */
function nominalInches(widthStr, productName) {
  const w = parseFloat(s(widthStr).replace(/[^0-9.]/g, ''));
  if (w > 0 && w < 200) return Math.round(w);
  // Fall back to the product name: "Paisley 30 In. Single Sink…"
  const m = s(productName).match(/(\d{2,3})\s*(?:in\b|inch|")/i);
  return m ? parseInt(m[1], 10) : null;
}

function readRichCatalogue(file, rows, stats) {
  const wb = XLSX.readFile(file, { dense: false });
  const sheetName = wb.SheetNames.find(n => /product data/i.test(n));
  if (!sheetName) { stats.skippedSheets.push(`${path.basename(file)} (no "Product Data" sheet)`); return; }

  const ws   = wb.Sheets[sheetName];
  // header:1 → array-of-arrays, so we can address the row-2 header by index.
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  if (grid.length < 3) return;

  // Row index 1 is the real header. Assert it, rather than trusting the doc.
  const hdr = grid[1].map(s);
  if (!/supplier sku/i.test(hdr[COL.sku] || '')) {
    throw new Error(
      `${path.basename(file)}: expected "Supplier SKU #" at header col ${COL.sku} ` +
      `of row 2, found "${hdr[COL.sku]}". The sheet layout changed — re-derive COL ` +
      `before trusting any output.`
    );
  }

  for (let r = 2; r < grid.length; r++) {
    const row = grid[r];
    const p   = parseSku(row[COL.sku]);
    if (!p) continue;

    stats.shapes[p.shape] = (stats.shapes[p.shape] || 0) + 1;

    const name = s(row[COL.product_name]);
    rows.set(p.sku, {
      sku:              p.sku,
      base_sku:         p.base,
      mirror_code:      p.mirror,
      faucet_code:      p.faucet,
      has_mirror:       hasOption(p.mirror) || /^y/i.test(s(row[COL.mirror_included])) ? 1 : 0,
      has_faucet:       hasOption(p.faucet) || /^y/i.test(s(row[COL.faucet_included])) ? 1 : 0,
      collection:       s(row[COL.collection]),
      vanity_part:      s(row[COL.vanity_part]),
      product_name:     name,
      size_nominal:     nominalInches(row[COL.width], name),
      width:            s(row[COL.width]),
      height:           s(row[COL.height]),
      depth:            s(row[COL.depth]),
      cabinet_color:    s(row[COL.cabinet_color]),
      cabinet_finish:   s(row[COL.cabinet_finish]),
      cabinet_material: s(row[COL.cabinet_material]),
      top_material:     s(row[COL.top_material]),
      top_finish:       s(row[COL.top_finish]),
      top_color:        s(row[COL.top_color]),
      top_edge:         s(row[COL.top_edge]),
      top_thickness:    s(row[COL.top_thickness]),
      top_width:        s(row[COL.top_width]),
      faucet_spacing:   s(row[COL.faucet_spacing]),
      sinks:            parseInt(s(row[COL.sinks]).replace(/[^0-9]/g, ''), 10) || null,
      sink_type:        s(row[COL.sink_type]),
      sink_shape:       s(row[COL.sink_shape]),
      mirror_sku:       s(row[COL.mirror_sku]),
      faucet_sku:       s(row[COL.faucet_sku]),
      faucet_finish:    s(row[COL.faucet_finish]),
      mounting:         s(row[COL.mounting]),
      doors:            parseInt(s(row[COL.doors]).replace(/[^0-9]/g, ''), 10) || null,
      ada:              /^y/i.test(s(row[COL.ada])) ? 1 : 0,
      source:           '2021',
    });
  }
}

function readLegacyCatalogue(file, rows, stats) {
  const wb = XLSX.readFile(file, { dense: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  if (!grid.length) return;

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    for (const idx of [LEGACY.new_sku, LEGACY.old_sku]) {
      const p = parseSku(row[idx]);
      if (!p) continue;
      if (rows.has(p.sku)) continue;          // never overwrite a 2021 row
      stats.legacyAdded++;
      rows.set(p.sku, {
        sku: p.sku, base_sku: p.base,
        mirror_code: p.mirror, faucet_code: p.faucet,
        has_mirror: hasOption(p.mirror) ? 1 : 0,
        has_faucet: hasOption(p.faucet) ? 1 : 0,
        collection: '', vanity_part: '',
        product_name: s(row[LEGACY.product_name]),
        size_nominal: nominalInches('', s(row[LEGACY.product_name])),
        width:'', height:'', depth:'',
        cabinet_color:'', cabinet_finish:'', cabinet_material:'',
        top_material:'', top_finish:'', top_color:'', top_edge:'',
        top_thickness:'', top_width:'', faucet_spacing:'',
        sinks:null, sink_type:'', sink_shape:'',
        mirror_sku:'', faucet_sku:'', faucet_finish:'',
        mounting:'', doors:null, ada:0,
        source: '2020',
      });
    }
  }
}

const FIELDS = [
  'sku','base_sku','mirror_code','faucet_code','has_mirror','has_faucet',
  'collection','vanity_part','product_name','size_nominal','width','height','depth',
  'cabinet_color','cabinet_finish','cabinet_material',
  'top_material','top_finish','top_color','top_edge','top_thickness','top_width',
  'faucet_spacing','sinks','sink_type','sink_shape',
  'mirror_sku','faucet_sku','faucet_finish','mounting','doors','ada','source',
];

const sqlVal = v => {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
};

function main() {
  const argv = process.argv.slice(2);
  let feedSkuFile = null;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--feed-skus') { feedSkuFile = argv[++i]; continue; }
    files.push(argv[i]);
  }

  if (!files.length) {
    console.error('usage: node scripts/wcDimensionSeed.js [--feed-skus <file>] <catalogue.xlsx> ...');
    process.exit(2);
  }

  const rows  = new Map();
  const stats = { shapes: {}, legacyAdded: 0, skippedSheets: [] };

  for (const f of files) {
    if (!fs.existsSync(f)) { console.error(`missing: ${f}`); process.exit(2); }
    const wb = XLSX.readFile(f, { dense: false, sheetRows: 3 });
    if (wb.SheetNames.some(n => /product data/i.test(n))) readRichCatalogue(f, rows, stats);
    else                                                  readLegacyCatalogue(f, rows, stats);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  /* ---- CSV, for eyeballing ---- */
  const csv = [FIELDS.join(',')];
  for (const r of rows.values()) {
    csv.push(FIELDS.map(f => {
      const v = r[f];
      if (v === null || v === undefined) return '';
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    }).join(','));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'wc_dimensions.csv'), csv.join('\n') + '\n');

  /* ---- SQL seed ---- */
  const sql = [
    '-- wc_dimensions seed — generated by scripts/wcDimensionSeed.js',
    `-- ${new Date().toISOString()}`,
    '-- Units only. No price columns by design (WC_REPORTS_SPEC.md §1).',
    '',
  ];
  const all = [...rows.values()];
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    sql.push(`INSERT INTO wc_dimensions (${FIELDS.join(', ')}) VALUES`);
    sql.push(chunk.map(r => '  (' + FIELDS.map(f => sqlVal(r[f])).join(', ') + ')').join(',\n'));
    sql.push('ON DUPLICATE KEY UPDATE ' +
      FIELDS.filter(f => f !== 'sku').map(f => `${f}=VALUES(${f})`).join(', ') + ';');
    sql.push('');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'wc_dimensions_seed.sql'), sql.join('\n'));

  /* ---- Summary. The numbers that decide whether this is usable. ---- */
  const bases       = new Set(all.map(r => r.base_sku));
  const collections = new Set(all.map(r => r.collection).filter(Boolean));
  const withColour  = all.filter(r => r.cabinet_color).length;
  const withSize    = all.filter(r => r.size_nominal).length;
  const withTop     = all.filter(r => r.top_material).length;

  console.log(`\nwc_dimensions seed`);
  console.log(`  SKUs (configurations)   ${all.length}`);
  console.log(`  distinct base SKUs      ${bases.size}   ← model-level rollup key`);
  console.log(`  collapse ratio          ${(all.length / Math.max(bases.size,1)).toFixed(2)} configs per model`);
  console.log(`  distinct collections    ${collections.size}`);
  console.log(`  from 2020 catalogue     ${stats.legacyAdded} (SKU + name only)`);
  console.log(`\nattribute fill`);
  console.log(`  cabinet_color           ${withColour}/${all.length} (${(100*withColour/all.length).toFixed(1)}%)`);
  console.log(`  size_nominal            ${withSize}/${all.length} (${(100*withSize/all.length).toFixed(1)}%)`);
  console.log(`  top_material            ${withTop}/${all.length} (${(100*withTop/all.length).toFixed(1)}%)`);
  console.log(`\nSKU shapes`);
  for (const [k, v] of Object.entries(stats.shapes).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
  if (stats.skippedSheets.length) console.log(`\nskipped: ${stats.skippedSheets.join(', ')}`);

  /* ---- Coverage against the feed, when we have the feed's SKU list ---- */
  if (feedSkuFile && fs.existsSync(feedSkuFile)) {
    const feed = new Set(
      fs.readFileSync(feedSkuFile, 'utf8').split(/\r?\n/)
        .map(l => l.trim().toUpperCase()).filter(Boolean)
    );
    let hit = 0;
    const missing = [];
    for (const sk of feed) (rows.has(sk) ? hit++ : missing.push(sk));
    console.log(`\ncoverage against feed (${feedSkuFile})`);
    console.log(`  feed SKUs               ${feed.size}`);
    console.log(`  described by catalogue   ${hit} (${(100*hit/feed.size).toFixed(1)}%)`);
    console.log(`  UNMAPPED                 ${missing.length}  ← must stay visible in the UI`);
    fs.writeFileSync(path.join(OUT_DIR, 'wc_unmapped_skus.txt'), missing.sort().join('\n') + '\n');
    if (missing.length) console.log(`  written to scripts/out/wc_unmapped_skus.txt`);
  } else {
    console.log(`\ncoverage against feed    UNKNOWN — rerun with --feed-skus once the`);
    console.log(`                         snapshots are available. Do not build the`);
    console.log(`                         unmapped-count UI on a guess.`);
  }
  console.log(`\nwrote scripts/out/wc_dimensions_seed.sql and wc_dimensions.csv\n`);
}

main();
