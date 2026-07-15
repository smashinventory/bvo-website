'use strict';
/**
 * Analyze JM feed rows that have no MAP Price.
 * No DB required — XLSX only.
 *
 * Usage:
 *   node analyze_jm_no_price.js "/path/to/JM_Etail_2026.xlsx"
 */

const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error('Usage: node analyze_jm_no_price.js <path-to-xlsx>');
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath, { cellDates: false });
const ws = wb.Sheets['Etail Products'];
if (!ws) {
  console.error('Sheet "Etail Products" not found.');
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

const cleanNum = v => {
  const n = parseFloat(String(v || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
};
const clean = v => (v === undefined || v === null) ? null : String(v).trim() || null;

const noPrice = rows.filter(r => cleanNum(r['MAP Price']) === null);

if (!noPrice.length) {
  console.log('✅ All rows have a MAP Price — nothing to report.');
  process.exit(0);
}

// Group by Product Type
const byType = {};
for (const r of noPrice) {
  const type   = clean(r['Product Type']) || '(blank)';
  const status = clean(r['Item Status'])  || '(blank)';
  const key    = type;
  if (!byType[key]) byType[key] = { count: 0, statuses: {}, skus: [] };
  byType[key].count++;
  byType[key].statuses[status] = (byType[key].statuses[status] || 0) + 1;
  if (byType[key].skus.length < 3) byType[key].skus.push(clean(r['Item Number']));
}

// Sort by count desc
const sorted = Object.entries(byType).sort((a, b) => b[1].count - a[1].count);

console.log(`\n══ JM Feed — Rows with no MAP Price: ${noPrice.length} of ${rows.length} ══\n`);
console.log(
  'Product Type'.padEnd(40),
  'Count'.padEnd(8),
  'Item Statuses',
  '  Sample SKUs'
);
console.log('─'.repeat(120));

for (const [type, info] of sorted) {
  const statusStr  = Object.entries(info.statuses).map(([s, n]) => `${s}(${n})`).join(', ');
  const skuPreview = info.skus.join(', ');
  console.log(
    type.padEnd(40),
    String(info.count).padEnd(8),
    statusStr.padEnd(40),
    skuPreview
  );
}

// Also show MSRP presence to understand if any have MSRP but no MAP
const hasMsrpNoMap = noPrice.filter(r => cleanNum(r['MSRP']) !== null);
console.log(`\nOf the ${noPrice.length} no-MAP rows: ${hasMsrpNoMap.length} have an MSRP value.`);

// Show full list of SKUs (optional — uncomment if needed)
// console.log('\nAll no-price SKUs:');
// noPrice.forEach(r => console.log(' ', clean(r['Item Number']), '|', clean(r['Product Type']), '|', clean(r['Item Status'])));
