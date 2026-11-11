'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * previewDisplayTitles.js — before/after for every product the heading rule
 * would change, as a CSV you can open in Excel.
 *
 * Run on the server, where the database is reachable:
 *
 *     cd ~/domains/bathroomvanitiesoutlet.com/hbuilds/current/nodejs
 *     node scripts/previewDisplayTitles.js > display_titles.csv
 *
 * ⚠️ READ-ONLY. This script SELECTs and prints. It writes nothing, changes
 * nothing, and touches no product row. The rule itself computes the heading
 * at render time — there is no column to migrate and nothing to undo — so
 * this exists purely so a human can look at the output before customers do.
 *
 * Columns: sku, product_type, changed, before, after
 *
 * Sort by `changed` to see only what moves, and read the `after` column for
 * anything that reads oddly. The rule only ever deletes known noise tokens
 * and swaps the first comma for a dash, so the worst case is a clumsy title
 * rather than one describing the wrong product — but clumsy is still worth
 * catching before it is on 6,400 pages.
 * ═══════════════════════════════════════════════════════════════════════════ */

try { require('dotenv').config(); } catch { /* dotenv optional */ }

const { displayTitle, isScoped } = require('../src/utils/displayTitle');

function csv(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
  const { bvoPool } = require('../src/config/database');

  /* Every active product, not just the scoped ones — so the file also shows
     what the rule leaves alone. A reviewer should be able to confirm the
     faucets and mirrors are untouched, not take it on trust. */
  const [rows] = await bvoPool.query(
    `SELECT sku, name, brand, product_type
       FROM products
      WHERE is_active = 1
      ORDER BY brand, product_type, name`
  );

  console.log(['sku', 'product_type', 'changed', 'before', 'after'].join(','));

  let scoped = 0, changed = 0;
  for (const r of rows) {
    const after = displayTitle(r.name, r);
    const didChange = after !== r.name;
    if (isScoped(r.brand, r.product_type)) scoped += 1;
    if (didChange) changed += 1;
    console.log([
      csv(r.sku), csv(r.product_type), didChange ? 'YES' : '',
      csv(r.name), csv(didChange ? after : ''),
    ].join(','));
  }

  /* To stderr, so it does not land in the CSV when the output is redirected. */
  console.error(`\n${rows.length} active products`);
  console.error(`${scoped} in scope (James Martin vanities)`);
  console.error(`${changed} would have a shortened heading`);
  console.error(`${scoped - changed} in scope but unchanged (no noise tokens in the name)`);

  await bvoPool.end();
})().catch(err => {
  console.error('[preview] failed:', err.message);
  process.exit(1);
});
