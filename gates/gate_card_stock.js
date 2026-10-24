'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_card_stock.js — a product card must know its own stock.

   THE DEFECT (found 2026-10-24, from a screenshot the owner sent). The
   same Bristol SKUs read "QTY: 0" on /collections/sale and "QTY: 3-6" on
   the model page. All 22 cards on the Deals page claimed to be out of
   stock. Nothing errored and nothing logged.

   WHY IT WAS INVISIBLE — the project's signature defect:

     qty_on_hand lives in the `inventory` table, NOT on `products`.
     An unselected column is `undefined`, never an error.
     collection.ejs does `parseInt(product.qty_on_hand || 0, 10)`.
     `undefined || 0` is 0. So a missing JOIN renders a confident zero.

   `|| 0` is doing the damage: it cannot tell "we asked and it is zero"
   from "we never asked". That is the same shape as the `subtotal` column
   that killed checkout for fourteen days (CHECKOUT_PAYMENT_LIFECYCLE §10)
   and the same shape as `Number(undefined)` in SESSION_HANDOFF §6.

   WHAT THIS GATE ASSERTS, and why it is written against the SHAPE of the
   query rather than against the sale branch by name: fixing only the sale
   query leaves the next hand-written listing free to repeat it. Every
   query in the storefront controllers that selects the product-card
   column set must also carry qty_on_hand. Product.js has joined inventory
   all along; this gate stops a caller from bypassing it.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

/* Files that build listings of product cards by hand. Product.js is the
   sanctioned path and is checked too — if IT ever loses the join, every
   listing on the site goes to zero at once. */
const FILES = [
  'src/controllers/collectionsController.js',
  'src/models/Product.js',
  'src/utils/modelHero.js',
];

/* A "product-card query" is one selecting the card's identity columns.
   Anchored on three together so a narrow lookup (say `SELECT p.id FROM
   products p WHERE slug = ?`) is not dragged in — those feed no card and
   requiring stock of them would be noise that gets the gate edited away. */
function isCardQuery(sql) {
  return /\bp\.slug\b/.test(sql) &&
         /\bp\.name\b/.test(sql) &&
         /\bp\.price\b/.test(sql) &&
         /FROM\s+products\s+p\b/i.test(sql);
}

console.log('--- every product-card query carries stock ---');

let examined = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { ok(rel + ' exists', false, 'missing'); continue; }

  /* Comments stripped FIRST. These queries are heavily commented and at
     least one comment now contains the words qty_on_hand and inventory
     explaining this very bug — prose must not satisfy a check about SQL.
     Rule 18 corollary, which has bitten this project twice. */
  const code = fs.readFileSync(full, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  /* Template literals are how every query here is written. */
  const literals = code.match(/`[^`]*`/g) || [];

  for (const lit of literals) {
    if (!isCardQuery(lit)) continue;
    examined++;

    const label = rel.split('/').pop() + ' #' + examined;

    const selectsQty = /\bqty_on_hand\b/.test(lit);
    ok(label + ' selects qty_on_hand', selectsQty,
       'the card will render "QTY: 0" for every row — undefined, not zero');

    /* Selecting it is not enough: it must come from somewhere. A bare
       `qty_on_hand` with no inventory table in the FROM/JOIN would be a
       SQL error at runtime, but an ALIASED select off the wrong table
       would not be. */
    if (selectsQty) {
      ok(label + ' joins the inventory table',
         /JOIN\s+inventory\s+\w+/i.test(lit),
         'qty_on_hand is selected but inventory is never joined');
    }
  }
}

ok('found product-card queries to check', examined > 0,
   'the shape detector matched nothing — it has drifted from the code');

/* ── The view half of the contract ────────────────────────────────── */
console.log('--- the view reads the column this gate protects ---');

const view = fs.readFileSync(path.join(ROOT, 'views/pages/collection.ejs'), 'utf8');
ok('collection.ejs reads product.qty_on_hand',
   /product\.qty_on_hand/.test(view),
   'the view renamed the field — this gate is now guarding nothing');

/* The `|| 0` is what converts a missing join into a confident zero. It is
   not removed (a blank QTY would be worse) but it IS pinned, so that if
   someone later makes the view defensive the gate is re-read rather than
   silently left protecting a line that moved. */
ok('the view still coerces a missing value to 0',
   /parseInt\(\s*product\.qty_on_hand\s*\|\|\s*0/.test(view),
   'the coercion changed — re-read this gate before trusting it');

console.log('\nproduct-card queries checked: ' + examined);
console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
