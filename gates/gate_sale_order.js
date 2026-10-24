'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_sale_order.js — /collections/sale is ordered by BEST ABSOLUTE
   DOLLAR SAVING, highest first. Owner's decision, 2026-10-24.

   WHAT IT REPLACED. `is_deal DESC, is_featured DESC, created_at DESC`,
   which ordered the page by what was newest. The live consequence: 18
   Huntington Brass faucets sat above every vanity, and the largest
   discount on the site was below the fold.

   WHY DOLLARS AND NOT A CATEGORY RANK. The owner's point was that money
   sorts vanities to the top on its own — a vanity saving $1,000 beats a
   faucet saving $50 — with no taxonomy hardcoded into this query. That
   matters more than it sounds: a category rank would have needed the
   vanity slug list inline, and 'bathroom-vanity-tops' is NOT a vanity, so
   the obvious prefix match on 'bathroom-vanit' would have silently
   promoted countertops. The loose-match family from SESSION_HANDOFF §6.

   TWO HALVES, AND THE SECOND IS THE ONE THAT WILL ACTUALLY CATCH SOMETHING:

     1. STATIC — the SQL's FIRST sort key is the saving, descending.
     2. EXECUTED — buildSaleView must PRESERVE the order it is given.
        The ordering lives in SQL, which a gate cannot run (Rule 14), but
        the util that pages and filters the pool can be run, and if it ever
        re-sorts, the SQL's work is silently discarded. That is the
        realistic regression: someone adds a "sort by price" feature and
        reaches for pool.sort() instead of a second query.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

/* ── 1. STATIC: the SQL ───────────────────────────────────────────── */
console.log('--- the sale query orders by absolute saving, first ---');

/* Comments stripped: the ORDER BY now carries a long comment that names
   the old clause verbatim (`is_deal DESC, is_featured DESC...`). Without
   stripping, a check for the OLD order would match the explanation of why
   it was replaced. Rule 18 corollary, and this file is a live example. */
const ctrl = fs.readFileSync(path.join(ROOT, 'src/controllers/collectionsController.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/* Scope to the sale query, not the whole controller — this file holds
   several queries and any of them could satisfy a loose match. The sale
   query is the one selecting `'sale' AS badge`. */
const iSale = ctrl.indexOf("'sale' AS badge");
const iEnd  = iSale !== -1 ? ctrl.indexOf('LIMIT 300', iSale) : -1;
const saleSql = (iSale !== -1 && iEnd > iSale) ? ctrl.slice(iSale, iEnd) : '';

ok('the sale query was located', saleSql.length > 0,
   'could not slice it — the badge marker or LIMIT 300 moved');

const orderMatch = saleSql.match(/ORDER BY([\s\S]*)$/);
const orderBy = orderMatch ? orderMatch[1].replace(/\s+/g, ' ').trim() : '';

ok('it has an ORDER BY', orderBy.length > 0, 'none found');

/* The FIRST key, not merely present somewhere. A saving expression sitting
   third would leave the page ordered by whatever precedes it.

   ⚠️ SPLIT AT PAREN DEPTH ZERO. A naive orderBy.split(',') cuts
   `COALESCE(p.compare_price, p.price)` at its own internal comma and hands
   back the fragment `(COALESCE(p.compare_price` — which contains no DESC
   and no closing paren, so all three checks below failed on CORRECT code.
   Caught on the first run of this gate. A false alarm is not harmless: the
   obvious "fix" is to loosen the assertions until they pass, which is how
   a gate becomes decoration. */
function topLevelKeys(clause) {
  const keys = [];
  let depth = 0, cur = '';
  for (const ch of clause) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { keys.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) keys.push(cur.trim());
  return keys;
}
const keys = topLevelKeys(orderBy);
const firstKey = keys[0] || '';
ok('the FIRST sort key is the saving',
   /compare_price/.test(firstKey) && /price\s*\)?\s*DESC/.test(firstKey),
   'first key is: ' + firstKey);

ok('it sorts the saving DESCENDING (biggest first)',
   /DESC/.test(firstKey) && !/\bASC\b/.test(firstKey),
   firstKey);

/* NULL compare_price is the realistic data case — a hand-picked product
   with no markdown. NULL - price is NULL, which sorts as a value. */
ok('NULL compare_price is coalesced, not subtracted raw',
   /COALESCE\s*\(\s*p\.compare_price\s*,/.test(firstKey),
   'a hand-picked row with no markdown would sort on NULL');

/* Without a unique final key the pool order is undefined between full
   ties, and both the facet counts and the page slice read this array. */
ok('the order is total — a unique column breaks ties last',
   /^p\.id\s+(DESC|ASC)$/.test(keys[keys.length - 1] || ''),
   'no unique final tiebreak, last key is: ' + (keys[keys.length - 1] || 'none'));

ok('the superseded created_at-first order is gone',
   !/^p\.is_deal\s+DESC$/i.test(firstKey),
   'is_deal still leads — the page is not ordered by saving');

/* ── 2. EXECUTED: the util must not re-sort ───────────────────────── */
console.log('--- buildSaleView preserves the order it is given ---');

const { buildSaleView } = require(path.join(ROOT, 'src/utils/saleFacets.js'));

/* Built in the order the SQL would return: saving 900, 600, 300, 50, 0.
   Deliberately NOT in price order, NOT in name order and NOT in id order,
   so any re-sort on any of those fields shows up as a different sequence. */
const pool = [
  { id: 9, slug: 'van-a', name: 'Vanity A', brand: 'ER Vanities',      product_type: 'Vanity', width_in: 60, price: 1800, compare_price: 2700 },
  { id: 2, slug: 'van-b', name: 'Vanity B', brand: 'James Martin',     product_type: 'Vanity', width_in: 36, price: 1200, compare_price: 1800 },
  { id: 7, slug: 'van-c', name: 'Vanity C', brand: 'ER Vanities',      product_type: 'Vanity', width_in: 30, price:  900, compare_price: 1200 },
  { id: 1, slug: 'fau-a', name: 'Faucet A', brand: 'Huntington Brass', product_type: 'Faucet', width_in: null, price: 150, compare_price: 200 },
  { id: 5, slug: 'fau-b', name: 'Faucet B', brand: 'Huntington Brass', product_type: 'Faucet', width_in: null, price: 120, compare_price: null },
];
const expected = pool.map(p => p.slug);

const unfiltered = buildSaleView(pool, {});
ok('unfiltered: order is preserved exactly',
   JSON.stringify(unfiltered.products.map(p => p.slug)) === JSON.stringify(expected),
   'got ' + unfiltered.products.map(p => p.slug).join(','));

ok('unfiltered: every row survives', unfiltered.total === pool.length,
   'total=' + unfiltered.total);

/* THE IMPORTANT ONE. Filtering must not reshuffle — the order a shopper
   sees with a brand filter on has to match what they saw without it. */
const filtered = buildSaleView(pool, { brand: 'ER Vanities' });
ok('filtered: survivors keep their relative order',
   JSON.stringify(filtered.products.map(p => p.slug)) === JSON.stringify(['van-a', 'van-c']),
   'got ' + filtered.products.map(p => p.slug).join(','));

/* A re-sort by price ascending, or by id, would both produce a DIFFERENT
   sequence than `expected` — stated so the next reader can see that this
   fixture actually discriminates rather than passing by luck. */
const byPriceAsc = [...pool].sort((a, b) => a.price - b.price).map(p => p.slug);
const byId       = [...pool].sort((a, b) => a.id - b.id).map(p => p.slug);
ok('the fixture can tell a re-sort apart (price order differs)',
   JSON.stringify(byPriceAsc) !== JSON.stringify(expected), 'fixture is degenerate');
ok('the fixture can tell a re-sort apart (id order differs)',
   JSON.stringify(byId) !== JSON.stringify(expected), 'fixture is degenerate');

console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
