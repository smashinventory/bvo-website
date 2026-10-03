#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   dumpModelSlugs.js — write src/config/modelSlugs.json from the live DB.

   Run:  node scripts/dumpModelSlugs.js
   Exit: 0 = written (or already correct), 1 = slug collision, 2 = no DB

   ─────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS

   Model pages are not rows in a table. They are DISTINCT products.model +
   products.brand, so there is no slug column to store a URL in — and
   recomputing a slug from a display name on every request means a model
   rename silently moves a live URL.

   So the committed JSON is the store. This script produces it; the gate
   diffs src/utils/modelSlug.js against it. A rename then shows up as a
   failing gate and a reviewable diff, which is the whole point.

   DETERMINISTIC OUTPUT, ON PURPOSE. Sorted, and with no generated-at
   timestamp. A re-run on an unchanged catalogue produces a byte-identical
   file, so `git diff` being non-empty MEANS the catalogue changed. A
   timestamp would make every run look like a change and the signal would
   be worthless within a week.

   WHY NOT READ THE `collections` TABLE
   It has a slug column and the JMV importer maintains it. Two reasons not
   to: its rows are inconsistently shaped (bristol-er-vanities carries the
   brand, kensington/london/oxford/windsor do not), and it is keyed on JM's
   "Collection Name", which has not been shown to equal products.model.
   See OPEN_ITEMS 11a. Until that is reconciled, this derives from the same
   column the model pages themselves are built on.
   ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { modelSlug, buildIndex } = require('../src/utils/modelSlug');

/* Same constant the mega menu uses (src/middleware/megaMenuData.js:24).
   Vanities are category 1. Hardcoded there, hardcoded here — if that ever
   moves it should become one exported constant, but duplicating a literal
   is better than this script silently reading a different category. */
const VANITY_CAT_ID = 1;

const OUT = path.join(__dirname, '..', 'src', 'config', 'modelSlugs.json');

(async () => {
  let pool;
  try {
    pool = require('../src/config/database').bvoPool;
  } catch (err) {
    console.error('Could not load the DB config: ' + err.message);
    process.exit(2);
  }

  let rows;
  try {
    /* is_active = 1 only: an inactive model has no page, so it gets no URL.
       ORDER BY in SQL as well as in JS — the sort must not depend on the
       server's collation surprising us later. */
    [rows] = await pool.query(`
      SELECT DISTINCT p.model, p.brand
      FROM products p
      WHERE p.is_active = 1
        AND p.category_id = ?
        AND p.model IS NOT NULL AND p.model <> ''
      ORDER BY p.brand, p.model
    `, [VANITY_CAT_ID]);
  } catch (err) {
    /* mysql2 puts the useful text in sqlMessage and code, NOT in message —
       `err.message` is often empty, which is how this first reported
       "Query failed:" with nothing after it and told Sam nothing. */
    console.error('\nQuery failed.');
    for (const k of ['code', 'errno', 'sqlState', 'sqlMessage', 'message']) {
      if (err[k]) console.error(`  ${k.padEnd(10)} ${err[k]}`);
    }
    if (!err.code && !err.sqlMessage && !err.message) {
      console.error('  the error object carried no detail — full dump:');
      console.error(require('util').inspect(err, { depth: 3 }));
    }
    console.error('\n  Likely causes, in order:');
    console.error('   ER_BAD_FIELD_ERROR  a column name is wrong for this schema');
    console.error('   ER_NO_SUCH_TABLE    `products` is not where expected');
    console.error('   ECONNREFUSED / ER_ACCESS_DENIED_ERROR  .env credentials');
    console.error('   no detail at all    the pool resolved but the query was rejected;');
    console.error('                       run the SQL by hand in phpMyAdmin:\n');
    console.error('     SELECT DISTINCT model, brand FROM products');
    console.error('     WHERE is_active = 1 AND category_id = 1');
    console.error("       AND model IS NOT NULL AND model <> ''");
    console.error('     ORDER BY brand, model;\n');
    await pool.end().catch(() => {});
    process.exit(2);
  }

  const pairs = rows.map(r => ({ model: r.model, brand: r.brand || '' }));

  /* ── collisions are a hard stop ──────────────────────────────────────
     Two pairs cannot share one URL. If this fires, the slug rule needs
     changing, not the data — and writing the file anyway would hide it. */
  const { collisions } = buildIndex(pairs);
  if (collisions.length) {
    console.error(`\n${collisions.length} SLUG COLLISION(S) — nothing written:\n`);
    for (const c of collisions) {
      console.error(`  ${c.slug}`);
      console.error(`     ${c.a.model} / ${c.a.brand}`);
      console.error(`     ${c.b.model} / ${c.b.brand}`);
    }
    console.error('\nThe always-brand-suffixed rule should make this impossible.');
    console.error('If it happened, two brands slugify to the same string.\n');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  /* Flag the data defect rather than encoding it. An empty brand yields a
     bare slug, which works but is not what anyone intended. */
  const noBrand = pairs.filter(p => !p.brand);
  if (noBrand.length) {
    console.warn(`\n⚠  ${noBrand.length} model(s) have no brand — they will get a bare slug:`);
    for (const p of noBrand) console.warn(`     ${p.model}`);
    console.warn('   products.brand should always be set. Worth fixing at source.\n');
  }

  const out = {
    _comment: 'GENERATED by scripts/dumpModelSlugs.js — do not hand-edit. '
            + 'The committed slug is the canonical URL; gate_model_slugs fails '
            + 'if src/utils/modelSlug.js stops agreeing with it, which is how a '
            + 'model rename is caught instead of silently moving a live URL.',
    source: 'SELECT DISTINCT model, brand FROM products '
          + `WHERE is_active = 1 AND category_id = ${VANITY_CAT_ID}`,
    pairs: pairs
      .map(p => ({ model: p.model, brand: p.brand, slug: modelSlug(p.model, p.brand) }))
      .sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  };

  const json = JSON.stringify(out, null, 2) + '\n';
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);

  console.log(`\n${out.pairs.length} model page(s) → src/config/modelSlugs.json`);
  if (prev === null)      console.log('  (new file)');
  else if (prev === json) console.log('  unchanged — the catalogue has not moved');
  else                    console.log('  CHANGED — read the git diff before committing');

  const byBrand = {};
  for (const p of out.pairs) byBrand[p.brand] = (byBrand[p.brand] || 0) + 1;
  for (const [b, n] of Object.entries(byBrand).sort((x, y) => y[1] - x[1])) {
    console.log(`     ${String(n).padStart(3)}  ${b}`);
  }
  console.log('\n  first few:');
  for (const p of out.pairs.slice(0, 5)) {
    console.log(`     /collections/vanity-models/${p.slug}`);
  }
  console.log('');

  await pool.end().catch(() => {});
  process.exit(0);
})();
