#!/usr/bin/env node
'use strict';

/* gate_erv_inventory_sync.js — the ER Vanities quantity feed.
 *
 * WHAT THIS JOB IS: a once-daily pull of sellable stock from RFLPOS into
 * inventory.qty_on_hand. It is NOT the RFLPOS product sync — that one does
 * catalogue import and stays parked. The division is Sam's, 2026-10-08:
 * existing sync owns full inventory file imports, this owns quantity updates
 * post-import.
 *
 * THE RISKS WORTH GATING, each one a thing that would be invisible if wrong:
 *
 *   1. WRITING TO products. The whole premise is that BVO owns ER Vanities
 *      content. The parked product sync runs `UPDATE products SET name=?,
 *      brand=?, price=?, short_desc=?` — if that shape ever appears in this
 *      job, 78 written product names become POS SKU strings, the brand becomes
 *      'Ethan Roth', and every price drops to the RFLPOS counter figure
 *      (PR1269: 1049.99 -> 699.99). Nothing would error.
 *
 *   2. MATCHING ON products.sku INSTEAD OF rflpos_item_id. Four products
 *      disagree by a half-inch between the two systems — BVO
 *      'London-29.5-WH-BN' vs RFLPOS 'London-29-WH-BN'. Matching on sku
 *      silently misses exactly those four and reports success on the other 74.
 *
 *   3. VALIDATING THE KEY WITH A PR-SHAPED REGEX. 7 of the 78 carry
 *      descriptive SKUs ('Kensington-41.5-DOAK-MB', the two Bridge Cabinets).
 *      A /^PR\d+$/ check drops them and they quietly stop receiving stock.
 *
 *   4. A PLAIN UPDATE RATHER THAN AN UPSERT. The 2026-09-05 ER Vanities load
 *      created no inventory rows at all, so `UPDATE inventory ... WHERE
 *      product_id=?` affects zero rows for all 78 and reports success.
 *
 *   5. THE GUARDS NOT FIRING. An unattended job that writes stock must refuse
 *      an empty feed, a total key mismatch, and a mass zeroing. Each is
 *      exercised here against a stubbed pool, not grepped for.
 *
 *   6. SUMMING MULTI-VARIATION ROWS. Every mapped product is single-variation
 *      today. If one becomes variable the feed returns two rows for one sku;
 *      summing or picking one would be wrong, so it must be flagged and
 *      skipped.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

/* COMMENTS ARE STRIPPED BEFORE ANY "THIS MUST BE ABSENT" CHECK.
   Both of these files explain at length what they deliberately do NOT do —
   ervInventorySync quotes the product sync's `UPDATE products SET name=?...`
   as the thing it avoids, and inventory.js names allow_backorder and
   reorder_point to say why they are missing. Grepping the raw text therefore
   found the hazard inside the comment warning against it and failed on
   correct code. Twice. strip() is the fix; use it for absence, raw text only
   when the comment itself is the thing being checked. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const JOB   = read('src/jobs/ervInventorySync.js');
const UTIL  = read('src/utils/inventory.js');
const UTILC = strip(UTIL);
const IMP   = read('src/jobs/importJamesMartinFeed.js');
const SH    = read('erv_inventory_sync.sh');
const PHPP  = path.join(ROOT, '..', 'bvo_sync.php');   // outside the repo on purpose

console.log('\ngate_erv_inventory_sync — quantity only, keyed correctly, refuses bad feeds\n');

/* ── 1. it cannot touch product content ─────────────────────────────── */
console.log('--- products is read-only to this job ---');
/* Scoped to statements, not the whole file: the header comment legitimately
   quotes the product sync's UPDATE as the thing being avoided. */
const sqlOnly = strip(JOB);
check(!/UPDATE\s+products/i.test(sqlOnly),
      'no UPDATE against products anywhere in executable code',
      'BVO owns ER Vanities names, brands, prices and descriptions');
check(!/INSERT\s+INTO\s+products/i.test(sqlOnly),
      'no INSERT into products — this job never creates a product');
/* Every SET clause in this job must belong to rflpos_sync_log. An earlier
   version of this check looked for `brand = ?` anywhere and failed on the
   SELECT's own `WHERE p.brand = ?` — a read filter, which is exactly what the
   job is supposed to do. Assignment lives in SET clauses, so check those. */
/* CASE-SENSITIVE, and shaped like SQL: uppercase SET, then an identifier,
   then '='. The `/gi` version matched JavaScript instead — `new Set()`,
   `bySku.set(...)`, and the literal string "is not set" — and reported three
   stray clauses in a job whose only SET is the log update. */
const setClauses = (sqlOnly.match(/\bSET\s+\w+\s*=[\s\S]{0,200}/g) || []);
check(setClauses.length > 0 && setClauses.every(c => /records_ok|records_err|error_detail|finished_at/.test(c)),
      'every SET clause in the job targets rflpos_sync_log, nothing else (' + setClauses.length + ')',
      'assignment to any product column would show up here');
const prodSelects = sqlOnly.match(/FROM\s+products/gi) || [];
check(prodSelects.length === 1,
      'products is referenced exactly once, and it is a SELECT (' + prodSelects.length + ')');
check(/SELECT[\s\S]{0,120}FROM\s+products/i.test(sqlOnly),
      'that single reference is a SELECT');

/* ── 2. the key ─────────────────────────────────────────────────────── */
console.log('--- the match key ---');
check(/rflpos_item_id/.test(sqlOnly), 'matching uses rflpos_item_id');
check(!/WHERE[\s\S]{0,80}p\.sku\s*=/i.test(sqlOnly) && !/ON\s+[\s\S]{0,40}\.sku\s*=/i.test(sqlOnly),
      'products.sku is never the join or match column',
      'four products differ by a half-inch between BVO and RFLPOS; sku-matching misses exactly those');
check(/p\.brand\s*=\s*\?/.test(sqlOnly) && /BRAND\s*=\s*'ER Vanities'/.test(JOB),
      "the lookup is scoped to brand = 'ER Vanities'",
      'rflpos_item_id holds RFLPOS products.id on sync-created rows and SKUs on hand-loaded ones');
check(!/\^PR|PR\\d|\/\^PR\\d\+\$\//.test(sqlOnly),
      'the key is NOT validated against a PR-shaped pattern',
      '7 of 78 carry descriptive SKUs and a PR regex would silently drop them');
check(!/\.toLowerCase\(\)[\s\S]{0,40}sku|sku[\s\S]{0,30}\.toLowerCase\(\)/.test(sqlOnly),
      'the key is not case-folded — it is matched as stored');

/* ── 3. the write is an upsert, through the shared helper ───────────── */
console.log('--- the write ---');
check(/require\('\.\.\/utils\/inventory'\)/.test(JOB),
      'quantity is written through utils/inventory, not a local copy');
check(/ON DUPLICATE KEY UPDATE/.test(UTILC),
      'and that helper is an UPSERT',
      'the ER Vanities load created no inventory rows, so a plain UPDATE writes nothing for all 78');
check(/INSERT INTO inventory/.test(UTILC) && !/INSERT INTO inventory/.test(sqlOnly),
      'the job holds no inventory SQL of its own');
check(!/allow_backorder|reorder_point/.test(UTILC),
      'the helper leaves allow_backorder and reorder_point alone',
      'those are manager settings; a quantity feed must not reset them');
/* The extraction must be a move, not a fork. */
check(!/async function upsertInventory/.test(IMP),
      'importJamesMartinFeed no longer defines its own copy');
check(/require\('\.\.\/utils\/inventory'\)/.test(IMP) && /await upsertInventory\(conn,/.test(IMP),
      'and calls the shared one with its call site unchanged');

/* ── 4. executed: row validation ────────────────────────────────────── */
console.log('--- executed: row validation ---');
const { readRow, ZERO_FLOOR, QTY_CEILING } = require(path.join(ROOT, 'src/jobs/ervInventorySync')).__test;
{
  const q = (row) => { const b = []; const r = readRow(row, b); return r ? r.qtyLocal : null; };
  const f = (row) => { const b = []; return readRow(row, b); };
  check(q({ sku: 'PR1269', qty_local: '3' }) === 3, 'a normal PR row reads through');
  check(q({ sku: 'Kensington-41.5-DOAK-MB', qty_local: '4' }) === 4,
        'a DESCRIPTIVE sku reads through — the 7 Kensingtons survive');
  check(q({ sku: 'PR0969', qty_local: '0' }) === 0, 'zero is a legitimate quantity, not a rejection');
  check(q({ sku: 'PR1270', qty_local: '0.5' }) === 0,
        'a fractional quantity floors down, so half a cabinet is not sold as one');
  check(q({ sku: 'PR1271', qty_local: '3.8' }) === 3,
        'floor not round — 3.8 is 3 cabinets, not 4');
  check(q({ sku: 'PR1273', qty_local: 'abc' }) === null, 'a non-numeric quantity is rejected');
  check(q({ sku: 'PR1274', qty_local: '99999' }) === null,
        'an absurd quantity is rejected (ceiling ' + QTY_CEILING + ')');
  check(q({ sku: '', qty_local: '5' }) === null, 'a row with no sku is rejected');

  /* NEGATIVE IS CLAMPED, NOT REJECTED. The old behaviour returned null, which
     left BVO's existing quantity standing — a cabinet oversold at the POS kept
     advertising stock. Asserted on both sides: the value is 0, and the row is
     NOT rejected, because returning null would also satisfy "quantity is not
     positive" and must not pass as a clamp. */
  check(q({ sku: 'PR1272', qty_local: '-1' }) === 0,
        'a negative quantity is CLAMPED to zero, not rejected');
  check(q({ sku: 'PR1275', qty_local: '-0.6' }) === 0,
        'a negative FRACTION clamps to zero too (SKU 100376, the live case)');
  {
    const b = []; readRow({ sku: 'PR1272', qty_local: '-1' }, b);
    check(b.length === 0, 'and a clamped negative is not pushed onto the rejected list');
  }

  /* The adjustment must be REPORTABLE, not just applied. A silently floored
     quantity is indistinguishable in the database from one RFLPOS really sent,
     which is the whole point of this change. */
  check(f({ sku: 'PR1271', qty_local: '3.8' }).adjusted === 'floored',
        'a floored row is flagged adjusted:floored');
  check(f({ sku: 'PR1271', qty_local: '3.8' }).rawLocal === 3.8,
        'and carries the figure the feed displayed, for the log line');
  check(f({ sku: 'PR1275', qty_local: '-0.6' }).adjusted === 'negative',
        'a clamped row is flagged adjusted:negative — reported apart from clean zeros');
  check(f({ sku: 'PR1275', qty_local: '-0.6' }).rawLocal === -0.6,
        'and carries -0.6, so the log names the figure not just the sku');
  check(f({ sku: 'PR1269', qty_local: '3' }).adjusted === null,
        'an untouched quantity is NOT flagged — the lists stay actionable');
  check(f({ sku: 'PR0969', qty_local: '0' }).adjusted === null,
        'a genuine zero is not reported as an adjustment');

  /* qty_all feeds the sellable-vs-all-locations line; a negative there must not
     surface as "all locations -3". */
  check(f({ sku: 'PR1276', qty_local: '2', qty_all: '-3' }).qtyAll === 0,
        'qty_all is clamped the same way, so the two figures stay comparable');

  /* formatSummary must actually PRINT them. The buckets existing is not the
     deliverable; the named lines in the cron mail are. */
  {
    const { formatSummary } = require(path.join(ROOT, 'src/jobs/ervInventorySync')).__test;
    const out = formatSummary({
      feedRows: 1, matched: 1, written: 0, zeroed: 0,
      notInBvo: [], notInFeed: [], rejected: [], duplicateSku: [], localVsAll: [],
      zeroSkus: [], dryRun: true,
      negativeQty: ['100376  (no BVO product)  feed -0.6 → 0'],
      flooredQty:  ['PR1004  (London-59.5S-DOAK-MB)  feed 3.8 → 3'],
    });
    check(/100376/.test(out) && /-0\.6/.test(out),
          'the summary names the negative sku AND the figure it displayed');
    check(/London-59\.5S-DOAK-MB/.test(out) && /3\.8/.test(out),
          'and names the floored sku with its BVO sku and the figure');
    check(/NEGATIVE AT SOURCE/.test(out),
          'negatives print under their own heading, not folded into the zero list');
  }
  let threw = false;
  try { readRow(null, []); readRow(undefined, []); } catch (e) { threw = true; }
  check(!threw, 'readRow does not throw on a null row');
}

/* ── 5. executed: the three whole-run guards ────────────────────────── */
console.log('--- executed: the guards refuse bad feeds ---');
{
  /* Stub the DB and the proxy in the require cache so run() is exercised with
     no server involved. The pool throws on any SQL the job should not issue,
     so an unexpected write surfaces here rather than in production. */
  const dbPath = require.resolve(path.join(ROOT, 'src/config/database'));
  const ssPath = require.resolve(path.join(ROOT, 'src/services/syncSettings'));
  let BVO = [], FEED = [], wrote = [];
  const pool = { query: async (sql, params) => {
    if (/INSERT INTO rflpos_sync_log/.test(sql)) return [{ insertId: 1 }];
    if (/UPDATE rflpos_sync_log/.test(sql))      return [{}];
    if (/FROM products/.test(sql))               return [BVO];
    if (/INSERT INTO inventory/.test(sql))       { wrote.push(params); return [{}]; }
    throw new Error('UNEXPECTED SQL: ' + sql.replace(/\s+/g, ' ').slice(0, 80));
  } };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { bvoPool: pool } };
  require.cache[ssPath] = { id: ssPath, filename: ssPath, loaded: true,
                            exports: { get: () => ({ ervBrandIds: [26] }), save: () => {} } };
  global.fetch = async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ ok: true, items: FEED }),
    json: async () => ({ ok: true, brands: [{ id: 26, name: 'Ethan Roth' }] }),
  });
  process.env.BVO_SYNC_TOKEN = process.env.BVO_SYNC_TOKEN || 'gate-stub';

  delete require.cache[require.resolve(path.join(ROOT, 'src/jobs/ervInventorySync'))];
  const { run } = require(path.join(ROOT, 'src/jobs/ervInventorySync'));

  const P = (id, sku, key) => ({ id, sku, rflpos_item_id: key });
  const F = (sku, l, a) => ({ sku, qty_local: l, qty_all: a == null ? l : a });

  const attempt = async (bvo, feed) => {
    BVO = bvo; FEED = feed; wrote = [];
    try { return { out: await run() }; } catch (e) { return { err: e.message }; }
  };

  return (async () => {
    let r;

    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2'), P(3, 'c', 'Kensington-41.5-DOAK-MB')],
                      [F('PR1', 3), F('PR2', 5), F('Kensington-41.5-DOAK-MB', 4)]);
    check(!r.err && r.out.written === 3, 'a healthy feed writes every matched row',
          r.err || ('written=' + (r.out && r.out.written)));

    r = await attempt([P(1, 'a', 'PR1')], []);
    check(/GUARD/.test(r.err || '') && /zero rows/.test(r.err || ''),
          'GUARD 1: an empty feed aborts the run',
          'an empty response is never a legitimate instruction to zero the catalogue');

    r = await attempt([P(1, 'a', '1269')], [F('PR1269', 3)]);
    check(/GUARD/.test(r.err || '') && /zero matched/.test(r.err || ''),
          'GUARD 2: a total key mismatch aborts rather than reporting success',
          'this is the rfl_id-vs-SKU drift that would otherwise look like a clean no-op run');

    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2'), P(3, 'c', 'PR3'), P(4, 'd', 'PR4')],
                      [F('PR1', 0), F('PR2', 0), F('PR3', 0), F('PR4', 1)]);
    check(/GUARD/.test(r.err || '') && /would go to zero/.test(r.err || ''),
          'GUARD 3: a mass zeroing aborts (3 of 4 > ' + (ZERO_FLOOR * 100) + '%)',
          'a broken join looks exactly like a simultaneous sell-out');

    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2'), P(3, 'c', 'PR3'), P(4, 'd', 'PR4')],
                      [F('PR1', 0), F('PR2', 2), F('PR3', 3), F('PR4', 1)]);
    check(!r.err && r.out.written === 4,
          'but a normal share of zeros (1 of 4) writes through',
          r.err || '');

    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2')],
                      [F('PR1', 3), F('PR1', 4), F('PR2', 5)]);
    check(!r.err && r.out.written === 1 && r.out.duplicateSku.length === 1,
          'a multi-variation sku is flagged and skipped, never summed',
          r.err || JSON.stringify({ written: r.out && r.out.written, dup: r.out && r.out.duplicateSku }));

    /* THE HALF-INCH TRAP, end to end: BVO.sku would match the feed, the key
       would not. The run must find nothing rather than quietly matching. */
    r = await attempt([P(1, 'London-29.5-WH-BN', 'PR0995')], [F('London-29-WH-BN', 3)]);
    check(/GUARD/.test(r.err || '') && /zero matched/.test(r.err || ''),
          'it does not fall back to products.sku when the key misses',
          'the four half-inch products are the live example of why');

    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2')], [F('PR1', 3), F('PR2', 5)]);
    check(!r.err && r.out.written === 2 && !r.out.rejected.length,
          'a clean two-row run writes two and rejects none');

    /* ── the adjustment lists, end to end ───────────────────────────────
       readRow flags the row; run() has to turn the flag into a named line
       carrying BOTH skus. Exercised through run() because the pairing with
       product.sku only exists there. */
    r = await attempt([P(1, 'London-59.5S-DOAK-MB', 'PR1004'), P(2, 'b', 'PR2')],
                      [F('PR1004', 3.8), F('PR2', 5)]);
    check(!r.err && r.out.flooredQty.length === 1 &&
          /PR1004/.test(r.out.flooredQty[0]) &&
          /London-59\.5S-DOAK-MB/.test(r.out.flooredQty[0]) &&
          /3\.8/.test(r.out.flooredQty[0]),
          'a floored row is listed with the sync key, the BVO sku and the feed figure',
          r.err || JSON.stringify(r.out && r.out.flooredQty));
    check(!r.err && wrote.some(p => p && p[1] === 3),
          'and 3 is what actually reaches the database, not 3.8');

    r = await attempt([P(1, 'London-59.5S-DOAK-MB', 'PR1004'), P(2, 'b', 'PR2')],
                      [F('PR1004', -0.6), F('PR2', 5)]);
    check(!r.err && r.out.negativeQty.length === 1 && /-0\.6/.test(r.out.negativeQty[0]),
          'a negative row is listed under negativeQty with the figure it displayed',
          r.err || JSON.stringify(r.out && r.out.negativeQty));
    check(!r.err && !r.out.rejected.length && r.out.matched === 2,
          'the clamped row still MATCHES and is not counted as an error',
          r.err || JSON.stringify({ rej: r.out && r.out.rejected, m: r.out && r.out.matched }));
    check(!r.err && wrote.some(p => p && p[1] === 0),
          'and zero is written, so the oversold cabinet stops advertising stock');

    /* SKU 100376 — negative at source AND absent from BVO. The live dry run's
       only rejected row was exactly this shape. It must still be reported:
       reporting only matched rows would have hidden the one piece of evidence
       that RFLPOS is emitting negatives at all. */
    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2')],
                      [F('PR1', 3), F('PR2', 5), F('100376', -0.6)]);
    check(!r.err && r.out.negativeQty.length === 1 && /100376/.test(r.out.negativeQty[0]),
          'an adjusted row with NO BVO product is still reported, not silently dropped',
          r.err || JSON.stringify(r.out && r.out.negativeQty));
    check(!r.err && /no BVO product/.test(r.out.negativeQty[0]),
          'and says so in place of a BVO sku rather than printing a bare key');
    check(!r.err && r.out.written === 2,
          'while writing only the two that matched');

    r = await attempt([P(1, 'a', 'PR1'), P(2, 'b', 'PR2')], [F('PR1', 3), F('PR2', 5)]);
    check(!r.err && !r.out.flooredQty.length && !r.out.negativeQty.length,
          'a clean feed reports NO adjustments — the lists mean something when non-empty');

    /* dry run must not write */
    BVO = [P(1, 'a', 'PR1'), P(2, 'b', 'PR2')]; FEED = [F('PR1', 3), F('PR2', 5)]; wrote = [];
    const dry = await run({ dryRun: true });
    check(dry.matched === 2 && dry.written === 0 && wrote.length === 0,
          '--dry matches but writes nothing, so the first run can be inspected safely');

    /* ── 6. the cron wrapper ──────────────────────────────────────────── */
    console.log('--- the cron wrapper ---');
    check(!/BVO_SYNC_TOKEN\s*=\s*\S/.test(SH.replace(/process\.env\.BVO_SYNC_TOKEN/g, '')) &&
          !/DB_PASS\s*=\s*\S/.test(SH.replace(/process\.env\.DB_PASS/g, '')),
          'no credential is hardcoded in the shell script',
          'jmv_rollup.sh carried an inline password and therefore had two copies differing by one line');
    check(/find_node\(\)/.test(SH),
          'it locates node explicitly — cron has no node on PATH (exit 127)');

    /* THE TWO FORMATTERS MUST AGREE. The wrapper has its own inline summary
       printer; formatSummary() in the job feeds the rflpos_sync_log row. They
       diverged on 2026-10-08 — the adjustment lists were added to the job and
       not to the wrapper, so the cron log, the only place anyone reads them,
       printed nothing and the clamped row looked like it had simply vanished.
       Every bucket the job reports must be printed by both. */
    /* Checked two ways, because merely FINDING the bucket name in the file is
       not enough: neutering the `if` around a printer leaves the name sitting
       in dead code and a substring check still passes. So the guarding
       condition must itself name the bucket, and no branch may be disabled. */
    for (const bucket of ['zeroSkus', 'negativeQty', 'flooredQty', 'notInBvo',
                          'notInFeed', 'rejected', 'duplicateSku', 'localVsAll']) {
      const guarded = new RegExp(
        'if\\s*\\([^)]*s\\.' + bucket + '[^)]*\\)[\\s\\S]{0,160}console\\.');
      check(guarded.test(SH),
            'the cron log prints s.' + bucket + ' — a bucket only the DB row shows is a bucket nobody reads');
    }
    check(!/if\s*\(\s*false/.test(SH),
          'no printer in the wrapper is disabled by a dead condition');
    check(/set \+e/.test(SH) && /EXIT=\$\?/.test(SH),
          'set -e is lifted around the node call so the exit code reaches the log');
    check(/exit\(78\)/.test(SH) && /BVO_SYNC_TOKEN/.test(SH),
          'a missing token exits 78 (EX_CONFIG) with its own message, separate from DB_PASS');
    check(/\/\^GUARD\/\.test/.test(SH) && /exit\(3\)/.test(SH),
          'a guard refusal exits 3, distinct from a crash',
          'otherwise a refusal reads as a transient failure and gets ignored');
    check(/--dry/.test(SH), 'and the wrapper passes --dry through for a safe first run');

    /* ── 7. the proxy, which lives outside the repo ───────────────────── */
    console.log('--- the proxy (outside the repo, delivered as an upload) ---');
    if (!fs.existsSync(PHPP)) {
      bad('bvo_sync.php not found beside the repo', PHPP);
    } else {
      const PHP = fs.readFileSync(PHPP, 'utf8');
      const invStart = PHP.indexOf("if ($action === 'inventory')");
      const invEnd   = PHP.indexOf('// ── Action: products', invStart);
      const INV      = invStart > -1 && invEnd > invStart ? PHP.slice(invStart, invEnd) : '';
      check(INV.length > 0, 'the inventory action exists and is delimited');
      check(!/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i.test(PHP),
            'the whole proxy is still SELECT-only');
      check(/'brands', 'products', 'inventory'/.test(PHP),
            'the action allow-list names exactly the three known actions');
      check(!/p\.name|product_description|sell_price|p\.image/.test(INV),
            'the inventory feed returns NO content columns',
            'it must not be possible to overwrite BVO product content from this feed');
      check(/is_local = 1[\s\S]{0,60}qty_available/.test(INV) && /qty_all/.test(INV),
            'it returns the is_local sum and the all-locations sum separately',
            'the gap between them is how a mis-set location flag becomes visible');
      check(/p\.enable_stock\s*=\s*1/.test(INV) && /v\.deleted_at IS NULL/.test(INV),
            'it carries the two filters the in-production Local Inventory query has',
            'enable_stock and deleted_at — both missing from the first draft of this query');
      check(/\$stmt->execute\(\$params\)/.test(INV),
            'the brand filter is parameterised, not interpolated');
      check(/sub_sku/.test(INV),
            'sub_sku is returned so a multi-variation product is detectable');
    }

    console.log('\n' + (fails
      ? 'gate_erv_inventory_sync: FAILED ' + fails + ' of ' + checks
      : 'gate_erv_inventory_sync: all ' + checks + ' checks pass'));
    process.exit(fails ? 1 : 0);
  })();
}
