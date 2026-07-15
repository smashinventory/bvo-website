'use strict';

/**
 * fixJmStyleData.js — One-time JM style cleanup script
 * ─────────────────────────────────────────────────────
 * Fixes existing JM product style EAV rows that were stored as raw
 * comma-separated JM theme strings (e.g. "Transitional, Traditional").
 *
 * After migration 011, the EAV table supports multiple rows per product
 * per attr_key. This script:
 *   1. Reads all product_attribute_values rows where attr_key = 'style'
 *   2. For each row, looks up value_text in JM_STYLE_MAP
 *   3. Deletes the old row
 *   4. Inserts one new row per BVO style bucket
 *
 * Products whose style value is already a valid BVO bucket are left alone.
 * Rows with no JM_STYLE_MAP match are flagged in the report but not deleted.
 *
 * RUN ON THE SERVER (not locally — needs bvoPool connection):
 *   node src/jobs/fixJmStyleData.js
 *
 * Dry-run mode (logs what would change, no DB writes):
 *   node src/jobs/fixJmStyleData.js --dry
 *
 * IMPORTANT: Run AFTER migration 011 (surrogate PK must exist first).
 */

const { bvoPool } = require('../config/database');

// ── JM_STYLE_MAP ─────────────────────────────────────────────────────
// Must stay in sync with the copy in importJamesMartinFeed.js.
// BVO canonical buckets: Traditional | Transitional | Modern | Farmhouse
//   Mid-Century Modern | Industrial | Coastal | Scandinavian | European / Old World
const JM_STYLE_MAP = {
  // ── Exact BVO buckets (pass-through, stored as-is) ───────────
  'Transitional':                      'Transitional',
  'Traditional':                       'Traditional',
  'Modern':                            'Modern',
  'Farmhouse':                         'Farmhouse',
  'Mid-Century Modern':                'Mid-Century Modern',
  'Industrial':                        'Industrial',
  'Coastal':                           'Coastal',
  'Scandinavian':                      'Scandinavian',
  'European / Old World':              'European / Old World',

  // ── JM multi-value / non-standard → BVO canonical ────────────
  'Transitional, Traditional':         'Traditional|Transitional',
  'Traditional, Transitional':         'Traditional|Transitional',
  'Contemporary/Modern, Transitional': 'Transitional|Modern',
  'Modern, Transitional':              'Transitional|Modern',
  'Transitional, Modern':              'Transitional|Modern',
  'Transitional, Farmhouse':           'Transitional|Farmhouse',
  'Farmhouse, Traditional':            'Traditional|Farmhouse',
  'Old World':                         'Traditional|European / Old World',
  'Traditional, Old World':            'Traditional|European / Old World',

  // ── Single-value normalizations ──────────────────────────────
  'Contemporary':                      'Modern',
  'Contemporary/Modern':               'Modern',
  'Contemporary, Modern':              'Modern',
  'Modern Farmhouse':                  'Farmhouse',
  'Modern Luxe':                       'Modern',
  'Commercial':                        'Modern',

  // ── JM 2-style combos ────────────────────────────────────────
  'Boho, Contemporary/Modern':                              'Modern|Farmhouse',
  'Farmhouse, Rustic-Modern, Contemporary/Modern':          'Modern|Farmhouse',
  'Modern Farmhouse, Transitional':                         'Transitional|Farmhouse',

  // ── JM 3-style combos (comma + period delimiter variants) ────
  'Contemporary/Modern, Modern Farmhouse, Transitional':    'Transitional|Modern|Farmhouse',
  'Contemporary/Modern, Modern Farmhouse. Transitional':    'Transitional|Modern|Farmhouse',
  'Contemporary/Modern, Modern Farmhouse.Transitional':     'Transitional|Modern|Farmhouse',
};

// All valid BVO single-value style buckets (already correct, skip these)
const BVO_STYLE_BUCKETS = new Set([
  'Traditional', 'Transitional', 'Modern', 'Farmhouse', 'Mid-Century Modern',
  'Industrial', 'Coastal', 'Scandinavian', 'European / Old World',
]);

const dry = process.argv.includes('--dry');

async function run() {
  console.log(`\n🔧  fixJmStyleData.js — JM style EAV cleanup${dry ? ' [DRY RUN]' : ''}`);
  console.log('─'.repeat(60));

  const conn = await bvoPool.getConnection();

  try {
    // Pull all style EAV rows with product name for reporting
    const [rows] = await conn.query(`
      SELECT pav.id, pav.product_id, pav.value_text, p.name AS product_name, p.brand
      FROM product_attribute_values pav
      JOIN products p ON p.id = pav.product_id
      WHERE pav.attr_key = 'style'
      ORDER BY p.brand, pav.product_id
    `);

    console.log(`Found ${rows.length} style EAV rows to inspect.\n`);

    let alreadyCorrect = 0;
    let fixed          = 0;
    let noMatch        = 0;
    const noMatchList  = [];

    for (const row of rows) {
      const raw = (row.value_text || '').trim();

      // Already a valid BVO bucket — nothing to do
      if (BVO_STYLE_BUCKETS.has(raw)) {
        alreadyCorrect++;
        continue;
      }

      const mapped = JM_STYLE_MAP[raw];

      if (!mapped) {
        noMatch++;
        noMatchList.push({ product_id: row.product_id, name: row.product_name, raw });
        continue;
      }

      const newStyles = mapped.split('|').map(s => s.trim());

      console.log(`  [product ${row.product_id}] "${row.product_name.slice(0, 50)}"`);
      console.log(`    OLD: "${raw}"`);
      console.log(`    NEW: ${newStyles.map(s => `"${s}"`).join(', ')}`);

      if (!dry) {
        // Delete the old single-value row by its surrogate id
        await conn.query(
          'DELETE FROM product_attribute_values WHERE id = ?',
          [row.id]
        );
        // Insert one row per BVO style bucket
        for (const styleVal of newStyles) {
          await conn.query(
            'INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num) VALUES (?, ?, ?, NULL)',
            [row.product_id, 'style', styleVal]
          );
        }
      }

      fixed++;
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`✅  Already correct BVO bucket: ${alreadyCorrect}`);
    console.log(`✅  Fixed (multi-value split):  ${fixed}${dry ? ' (dry — no writes)' : ''}`);
    console.log(`⚠️   No JM_STYLE_MAP match:      ${noMatch}`);

    if (noMatchList.length) {
      console.log('\n  Unmatched values (manual review needed):');
      for (const item of noMatchList) {
        console.log(`    product_id=${item.product_id}  "${item.raw}"  →  ${item.name.slice(0, 60)}`);
      }
      console.log('\n  To fix these, add entries to JM_STYLE_MAP in both');
      console.log('  importJamesMartinFeed.js and fixJmStyleData.js, then re-run.');
    }

  } finally {
    conn.release();
    await bvoPool.end();
  }
}

run().catch(err => {
  const detail = err.message || err.code || err.sqlMessage || JSON.stringify(err);
  console.error('\n❌  Error:', detail);
  if (err.code)    console.error('    Code:', err.code);
  if (err.address) console.error('    Host:', err.address, 'Port:', err.port);
  console.error('\nNOTE: This script requires a live DB connection.');
  console.error('Run on the Hostinger server, not locally (local Mac has no MySQL).');
  process.exit(1);
});
